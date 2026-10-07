import json
from pathlib import Path
from core.logging import get_logger
from core.database import get_database
from core.queue import get_queue, QUEUE_REASONING
from core.audit import get_audit_logger
from services.llm.router import LLMRouter
from services.ocr.extract import TextractOCR


logger = get_logger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"


CLASSIFICATION_PROMPT = """Classify this document into ONE of these categories:
- invoice
- receipt
- bank_statement
- contract
- id_document
- other

Document (first 2000 chars):
{text}

Respond with ONLY the category name in lowercase, no explanation."""


class LLMExtractWorker:
    def __init__(self):
        self.db = get_database()
        self.queue = get_queue()
        self.ocr = TextractOCR()
        self.llm = LLMRouter()
        self.audit = get_audit_logger()

    def handle(self, job: dict) -> dict:
        document_id = job["document_id"]
        storage_path = job["storage_path"]
        content_type = job["content_type"]

        logger.info("Extracting", extra={"extra_document_id": document_id})

        raw_text = self.ocr.extract_from_storage(storage_path, content_type)
        if not raw_text or len(raw_text.strip()) < 50:
            return self._escalate(document_id, "ocr_empty")

        doc_type = self._classify(raw_text)
        logger.info("Classified", extra={"extra_document_id": document_id, "extra_type": doc_type})

        prompt_file = f"{doc_type}.txt"
        prompt_path = PROMPTS_DIR / prompt_file
        if not prompt_path.exists():
            return self._escalate(document_id, f"unknown_type:{doc_type}")

        extracted = self._extract_with_llm(raw_text, prompt_file)
        confidence = self._compute_confidence(extracted)

        self.db.client.table("extractions").insert({
            "document_id": document_id,
            "extracted_fields": extracted["fields"],
            "confidence": confidence,
            "model_used": extracted["model"],
            "prompt_version": extracted["prompt_version"],
        }).execute()

        self.db.client.table("documents").update({
            "type": doc_type,
            "status": "extracted",
            "raw_text": raw_text[:10000],
        }).eq("id", document_id).execute()

        self.audit.log_ai_action(
            action="ai.extraction.completed",
            document_id=document_id,
            model=extracted["model"],
            context={"doc_type": doc_type, "confidence": confidence},
        )

        if confidence >= 0.95:
            status = "auto_approved"
        elif confidence >= 0.80:
            status = "review_needed"
        else:
            return self._escalate(document_id, f"low_confidence:{confidence:.2f}")

        self.queue.push(QUEUE_REASONING, {
            "document_id": document_id,
            "type": doc_type,
            "fields": extracted["fields"],
            "confidence": confidence,
            "status": status,
        })

        logger.info("Extraction done", extra={
            "extra_document_id": document_id,
            "extra_confidence": confidence,
            "extra_status": status,
        })

        return {
            "document_id": document_id,
            "type": doc_type,
            "confidence": confidence,
            "status": status,
        }

    def _classify(self, text: str) -> str:
        prompt = CLASSIFICATION_PROMPT.format(text=text[:2000])
        result = self.llm.call(model="gpt-4o-mini", prompt=prompt, max_tokens=20, temperature=0)
        return result.strip().lower().split()[0] if result.strip() else "unknown"

    def _extract_with_llm(self, text: str, prompt_file: str) -> dict:
        prompt_path = PROMPTS_DIR / prompt_file
        prompt_template = prompt_path.read_text(encoding="utf-8")
        prompt = prompt_template.replace("{{DOCUMENT_TEXT}}", text[:15000])

        result = self.llm.call(
            model="gpt-4o",
            prompt=prompt,
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=2000,
        )

        parsed = json.loads(result)
        return {
            "fields": parsed.get("fields", {}),
            "model": "gpt-4o",
            "prompt_version": prompt_file.replace(".txt", ""),
        }

    def _compute_confidence(self, extracted: dict) -> float:
        fields = extracted["fields"]
        required = ["total_amount", "date", "supplier_name"]
        present = sum(1 for f in required if fields.get(f))
        completeness = present / len(required)
        llm_conf = fields.get("_confidence", 0.85)

        consistency = 1.0
        try:
            amount = float(fields.get("total_amount", 0))
            if amount <= 0:
                consistency -= 0.3
            vat = float(fields.get("vat_amount", 0))
            if vat > amount:
                consistency -= 0.4
        except (ValueError, TypeError):
            consistency -= 0.2

        return round((completeness * 0.4) + (llm_conf * 0.4) + (consistency * 0.2), 2)

    def _escalate(self, document_id: str, reason: str) -> dict:
        self.db.client.table("exceptions").insert({
            "document_id": document_id,
            "reason": reason,
            "severity": "high" if "low_confidence" in reason else "medium",
            "status": "open",
        }).execute()

        self.db.client.table("documents").update({
            "status": "exception",
        }).eq("id", document_id).execute()

        logger.warning("Escalated", extra={
            "extra_document_id": document_id,
            "extra_reason": reason,
        })

        return {"document_id": document_id, "status": "exception", "reason": reason}
