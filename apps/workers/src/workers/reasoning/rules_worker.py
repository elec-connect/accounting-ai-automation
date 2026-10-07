from core.logging import get_logger
from core.database import get_database
from core.queue import get_queue, QUEUE_DELIVERY
from core.audit import get_audit_logger


logger = get_logger(__name__)


class RulesWorker:
    """Applique les regles metier comptables."""

    def __init__(self):
        self.db = get_database()
        self.queue = get_queue()
        self.audit = get_audit_logger()

    def handle(self, job: dict) -> dict:
        document_id = job["document_id"]
        doc_type = job["type"]
        fields = job["fields"]
        confidence = job["confidence"]

        logger.info("Applying rules", extra={
            "extra_document_id": document_id,
            "extra_type": doc_type,
        })

        # 1. Validation
        validation = self._validate(fields, doc_type)
        if not validation["valid"]:
            return self._escalate(document_id, f"business_rule:{validation['reason']}")

        # 2. Decision
        requires_approval = self._requires_approval(fields)

        if requires_approval:
            status = "pending_approval"
            logger.info("Requires manual approval", extra={
                "extra_document_id": document_id,
                "extra_amount": fields.get("total_amount"),
            })
        else:
            status = "approved"

        # 3. Mise a jour du document
        self.db.client.table("documents").update({
            "status": status,
        }).eq("id", document_id).execute()

        # 4. Audit
        self.audit.log(
            action="document.rules_applied",
            resource_type="document",
            resource_id=document_id,
            context={
                "validation": validation,
                "requires_approval": requires_approval,
                "status": status,
            },
        )

        # 5. Push vers delivery (seulement si approuve)
        if status == "approved":
            self.queue.push(QUEUE_DELIVERY, {
                "document_id": document_id,
                "type": doc_type,
                "fields": fields,
                "status": status,
            })
            logger.info("Pushed to delivery queue", extra={
                "extra_document_id": document_id,
            })

        return {
            "document_id": document_id,
            "status": status,
            "requires_approval": requires_approval,
        }

    def _validate(self, fields: dict, doc_type: str) -> dict:
        """Valide les champs selon le type de document."""

        if doc_type == "invoice":
            # Montant present
            if not fields.get("total_amount"):
                return {"valid": False, "reason": "missing_amount"}

            # Montant numerique et positif
            try:
                amount = float(fields["total_amount"])
                if amount <= 0:
                    return {"valid": False, "reason": "invalid_amount"}
                if amount > 100000:
                    return {"valid": False, "reason": "amount_too_high"}
            except (ValueError, TypeError):
                return {"valid": False, "reason": "amount_not_numeric"}

            # TVA <= total
            vat = fields.get("vat_amount")
            if vat is not None:
                try:
                    vat_val = float(vat)
                    if vat_val > amount:
                        return {"valid": False, "reason": "vat_exceeds_total"}
                except (ValueError, TypeError):
                    pass

            # Date presente
            if not fields.get("date"):
                return {"valid": False, "reason": "missing_date"}

        return {"valid": True}

    def _requires_approval(self, fields: dict) -> bool:
        """Determine si le document necessite une validation manuelle."""
        try:
            amount = float(fields.get("total_amount", 0))
            return amount > 10000
        except (ValueError, TypeError):
            return True

    def _escalate(self, document_id: str, reason: str) -> dict:
        """Envoie le document dans la file d'exceptions."""
        self.db.client.table("exceptions").insert({
            "document_id": document_id,
            "reason": reason,
            "severity": "medium",
            "status": "open",
        }).execute()

        self.db.client.table("documents").update({
            "status": "exception",
        }).eq("id", document_id).execute()

        self.audit.log(
            action="document.escalated",
            resource_type="document",
            resource_id=document_id,
            context={"reason": reason},
        )

        logger.warning("Document escalated", extra={
            "extra_document_id": document_id,
            "extra_reason": reason,
        })

        return {
            "document_id": document_id,
            "status": "exception",
            "reason": reason,
        }
