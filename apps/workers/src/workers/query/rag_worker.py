from core.database import get_database
from core.logging import get_logger
from core.audit import get_audit_logger


logger = get_logger(__name__)


class RAGWorker:
    def __init__(self):
        self.db = get_database()
        self.audit = get_audit_logger()

    def ask(self, question: str, user_id: str | None = None) -> dict:
        # Version stub pour dev sans OpenAI
        logger.info("RAG stub called", extra={"extra_question": question[:100]})
        return {
            "answer": f"STUB: You asked '{question}'. RAG is not fully implemented yet.",
            "sources": [],
            "confidence": 0.0,
            "model_used": "stub",
            "tokens_used": 0,
        }
