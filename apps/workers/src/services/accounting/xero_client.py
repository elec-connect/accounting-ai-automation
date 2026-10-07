from core.logging import get_logger


logger = get_logger(__name__)


class XeroClient:
    """Client Xero stub pour dev sans vraies cles API."""

    def __init__(self):
        logger.info("XeroClient initialized (STUB mode)")

    def create_invoice(self, fields: dict) -> dict:
        """Simule la creation d'une facture dans Xero."""
        logger.info("Xero STUB: creating invoice", extra={
            "extra_supplier": fields.get("supplier_name"),
            "extra_amount": fields.get("total_amount"),
            "extra_currency": fields.get("currency", "GBP"),
        })

        # Generer un ID Xero simule
        import uuid
        xero_id = f"stub-xero-{uuid.uuid4().hex[:12]}"

        return {
            "InvoiceID": xero_id,
            "InvoiceNumber": fields.get("invoice_number", ""),
            "Reference": fields.get("invoice_number", ""),
            "Status": "AUTHORISED",
            "Total": float(fields.get("total_amount", 0)),
            "CurrencyCode": fields.get("currency", "GBP"),
        }
