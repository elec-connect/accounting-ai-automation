import base64
from dataclasses import dataclass, field
from core.config import get_settings


@dataclass
class ParsedAttachment:
    filename: str
    content: bytes
    content_type: str
    size: int


@dataclass
class ParsedEmail:
    message_id: str
    from_email: str
    from_name: str
    to_email: str
    subject: str
    text_body: str
    html_body: str
    attachments: list[ParsedAttachment] = field(default_factory=list)
    received_at: str = ""


class PostmarkParser:
    def __init__(self):
        self.settings = get_settings()

    def parse(self, payload: dict) -> ParsedEmail:
        return ParsedEmail(
            message_id=payload.get("MessageID", ""),
            from_email=payload.get("From", ""),
            from_name=payload.get("FromName", ""),
            to_email=payload.get("To", ""),
            subject=payload.get("Subject", ""),
            text_body=payload.get("TextBody", ""),
            html_body=payload.get("HtmlBody", ""),
            attachments=self._parse_attachments(payload.get("Attachments", [])),
            received_at=payload.get("Date", ""),
        )

    def _parse_attachments(self, raw: list) -> list[ParsedAttachment]:
        parsed = []
        max_bytes = self.settings.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
        for att in raw:
            content_type = att.get("ContentType", "")
            filename = att.get("Name", "unnamed")
            content_b64 = att.get("Content", "")
            size = att.get("ContentLength", 0)
            if content_type not in self.settings.ALLOWED_MIME_TYPES:
                continue
            if size > max_bytes:
                continue
            try:
                content = base64.b64decode(content_b64)
            except Exception:
                continue
            parsed.append(ParsedAttachment(filename, content, content_type, size))
        return parsed
