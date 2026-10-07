from core.logging import get_logger


logger = get_logger(__name__)


class TextractOCR:
    def __init__(self):
        pass

    def extract_from_storage(self, storage_path: str, content_type: str) -> str:
        \"\"\"Retourne un texte OCR simule pour dev.\"\"\"
        logger.info(\"OCR STUB called\", extra={\"extra_path\": storage_path})

        return \"\"\"INVOICE

Supplier: Acme Ltd
Invoice Number: INV-2026-001
Date: 2026-10-07
Due Date: 2026-11-07

Description: Consulting services - October 2026
Subtotal: 1000.00 GBP
VAT (20%): 250.00 GBP
Total: 1250.00 GBP

Payment Terms: Net 30
\"\"\"
