import uuid
from datetime import datetime
from core.database import get_supabase
from core.config import get_settings
from core.logging import get_logger


logger = get_logger(__name__)


class SupabaseStorage:
    def __init__(self):
        settings = get_settings()
        self.client = get_supabase()
        self.bucket = settings.SUPABASE_STORAGE_BUCKET

    def _build_path(self, document_id: str, filename: str) -> str:
        today = datetime.utcnow()
        return f"{today.year}/{today.month:02d}/{today.day:02d}/{document_id}/{filename}"

    def upload(self, document_id, filename, content, content_type) -> str:
        path = self._build_path(document_id, filename)
        try:
            self.client.storage.from_(self.bucket).upload(
                path=path, file=content,
                file_options={"content-type": content_type, "upsert": "false"},
            )
            return path
        except Exception as e:
            logger.error("Upload failed", extra={"extra_error": str(e)})
            raise


def generate_document_id() -> str:
    return str(uuid.uuid4())
