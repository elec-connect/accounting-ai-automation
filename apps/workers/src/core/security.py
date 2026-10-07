import hmac
import hashlib
from .config import get_settings


def verify_postmark_signature(payload: bytes, signature: str) -> bool:
    settings = get_settings()
    expected = hmac.new(
        settings.POSTMARK_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def compute_content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
