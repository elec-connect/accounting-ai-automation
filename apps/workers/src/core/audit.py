from core.logging import get_logger


logger = get_logger(__name__)


class AuditContext:
    def __init__(
        self,
        actor_id: str | None = None,
        actor_email: str | None = None,
        actor_role: str | None = None,
        actor_type: str = "system",
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        session_id: str | None = None,
    ):
        self.actor_id = actor_id
        self.actor_email = actor_email
        self.actor_role = actor_role
        self.actor_type = actor_type
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.request_id = request_id
        self.session_id = session_id


class AuditLogger:
    def log(
        self,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        resource_label: str | None = None,
        before: dict | None = None,
        after: dict | None = None,
        context: dict | None = None,
        status: str = "success",
        tags: list[str] | None = None,
        audit_context: AuditContext | None = None,
    ) -> int:
        logger.info("AUDIT", extra={
            "extra_action": action,
            "extra_resource_type": resource_type,
            "extra_resource_id": resource_id,
        })
        return 1

    def log_document_action(self, action, document_id, filename, after=None, audit_context=None):
        return self.log(
            action=action,
            resource_type="document",
            resource_id=document_id,
            resource_label=filename,
            after=after,
            audit_context=audit_context,
        )

    def log_ai_action(self, action, document_id=None, model=None, context=None):
        return self.log(
            action=action,
            resource_type="ai",
            resource_id=document_id,
            context={**(context or {}), "model": model},
        )


_audit_logger = None


def get_audit_logger() -> AuditLogger:
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger
