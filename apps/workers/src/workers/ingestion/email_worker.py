import json
from core.config import get_settings
from core.database import get_database
from core.queue import get_queue, QUEUE_EXTRACTION
from core.logging import get_logger
from core.security import verify_postmark_signature, compute_content_hash
from core.audit import get_audit_logger, AuditContext
from services.email.postmark_parser import PostmarkParser, ParsedEmail
from services.storage.supabase_storage import SupabaseStorage, generate_document_id


logger = get_logger(__name__)


class EmailIngestionWorker:
    def __init__(self):
        self.settings = get_settings()
        self.db = get_database()
        self.queue = get_queue()
        self.storage = SupabaseStorage()
        self.parser = PostmarkParser()
        self.audit = get_audit_logger()

    def handle(self, raw_payload: bytes, signature: str) -> dict:
        if not verify_postmark_signature(raw_payload, signature):
            raise PermissionError("Invalid signature")

        payload = json.loads(raw_payload)
        email = self.parser.parse(payload)

        results = []
        for attachment in email.attachments:
            try:
                result = self._process_attachment(email, attachment)
                results.append(result)
            except Exception as e:
                logger.error("Attachment failed", extra={"extra_error": str(e)})
                results.append({"filename": attachment.filename, "status": "failed", "error": str(e)})

        return {
            "message_id": email.message_id,
            "processed": len([r for r in results if r["status"] == "created"]),
            "duplicates": len([r for r in results if r["status"] == "duplicate"]),
            "failed": len([r for r in results if r["status"] == "failed"]),
            "results": results,
        }

    def _process_attachment(self, email: ParsedEmail, attachment) -> dict:
        content_hash = compute_content_hash(attachment.content)
        existing = self.db.find_by_hash(content_hash)
        if existing:
            return {"filename": attachment.filename, "status": "duplicate", "document_id": existing["id"]}

        document_id = generate_document_id()
        storage_path = self.storage.upload(
            document_id=document_id, filename=attachment.filename,
            content=attachment.content, content_type=attachment.content_type,
        )

        self.db.insert_document({
            "id": document_id, "type": "unknown", "source": "email",
            "status": "received", "storage_path": storage_path,
            "content_hash": content_hash, "original_filename": attachment.filename,
            "content_type": attachment.content_type, "file_size": attachment.size,
            "sender_email": email.from_email, "subject": email.subject,
            "metadata": {"message_id": email.message_id},
        })

        self.audit.log_document_action(
            action="document.ingested", document_id=document_id,
            filename=attachment.filename,
            after={"status": "received", "source": "email"},
            audit_context=AuditContext(actor_type="system", request_id=email.message_id),
        )

        self.queue.push(QUEUE_EXTRACTION, {
            "document_id": document_id, "storage_path": storage_path,
            "content_type": attachment.content_type, "source": "email",
        })

        return {"filename": attachment.filename, "status": "created", "document_id": document_id}
