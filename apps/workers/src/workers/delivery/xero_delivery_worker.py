from core.logging import get_logger
from core.database import get_database
from core.audit import get_audit_logger
from services.accounting.xero_client import XeroClient


logger = get_logger(__name__)


class XeroDeliveryWorker:
    """Envoie les documents approuves vers Xero."""

    def __init__(self):
        self.db = get_database()
        self.xero = XeroClient()
        self.audit = get_audit_logger()

    def handle(self, job: dict) -> dict:
        document_id = job["document_id"]
        doc_type = job["type"]
        fields = job["fields"]
        status = job.get("status", "approved")

        logger.info("Delivering to Xero", extra={
            "extra_document_id": document_id,
            "extra_type": doc_type,
        })

        # 1. Seulement les invoices
        if doc_type != "invoice":
            logger.info("Skipping non-invoice", extra={
                "extra_document_id": document_id,
                "extra_type": doc_type,
            })
            return {
                "document_id": document_id,
                "status": "skipped",
                "reason": f"type_{doc_type}_not_delivered",
            }

        # 2. Verifier que le document est approuve
        if status != "approved":
            return {
                "document_id": document_id,
                "status": "skipped",
                "reason": f"status_{status}_not_deliverable",
            }

        # 3. Envoyer vers Xero
        try:
            xero_result = self.xero.create_invoice(fields)

            # 4. Mettre a jour le document
            # On recupere d'abord les metadonnees existantes
            doc_response = (
                self.db.client.table("documents")
                .select("metadata")
                .eq("id", document_id)
                .single()
                .execute()
            )
            existing_metadata = doc_response.data.get("metadata") or {}

            new_metadata = {
                **existing_metadata,
                "xero_id": xero_result["InvoiceID"],
                "xero_status": xero_result["Status"],
                "xero_delivered_at": __import__("datetime").datetime.utcnow().isoformat(),
            }

            self.db.client.table("documents").update({
                "status": "delivered",
                "metadata": new_metadata,
            }).eq("id", document_id).execute()

            # 5. Audit
            self.audit.log(
                action="document.delivered",
                resource_type="document",
                resource_id=document_id,
                resource_label=fields.get("supplier_name", ""),
                after={
                    "status": "delivered",
                    "xero_id": xero_result["InvoiceID"],
                },
                tags=["delivery", "xero"],
            )

            logger.info("Delivered to Xero", extra={
                "extra_document_id": document_id,
                "extra_xero_id": xero_result["InvoiceID"],
            })

            return {
                "document_id": document_id,
                "status": "delivered",
                "xero_id": xero_result["InvoiceID"],
            }

        except Exception as e:
            logger.error("Xero delivery failed", extra={
                "extra_document_id": document_id,
                "extra_error": str(e),
            }, exc_info=True)

            # Creer une exception
            self.db.client.table("exceptions").insert({
                "document_id": document_id,
                "reason": f"xero_error:{str(e)[:100]}",
                "severity": "high",
                "status": "open",
            }).execute()

            self.db.client.table("documents").update({
                "status": "exception",
            }).eq("id", document_id).execute()

            return {
                "document_id": document_id,
                "status": "failed",
                "error": str(e),
            }
