import json
import redis
from functools import lru_cache
from datetime import datetime
from .config import get_settings


QUEUE_INGESTION = "queue:ingestion"
QUEUE_EXTRACTION = "queue:extraction"
QUEUE_REASONING = "queue:reasoning"
QUEUE_QUALITY = "queue:quality"
QUEUE_DELIVERY = "queue:delivery"


class Queue:
    def __init__(self):
        settings = get_settings()
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def push(self, queue_name: str, payload: dict) -> str:
        payload = {**payload, "enqueued_at": datetime.utcnow().isoformat()}
        return str(self.client.lpush(queue_name, json.dumps(payload)))

    def pop(self, queue_name: str, timeout: int = 5) -> dict | None:
        result = self.client.brpop(queue_name, timeout=timeout)
        if result is None:
            return None
        _, raw = result
        return json.loads(raw)

    def queue_size(self, queue_name: str) -> int:
        return self.client.llen(queue_name)

    def health(self) -> bool:
        try:
            self.client.ping()
            return True
        except redis.ConnectionError:
            return False


@lru_cache
def get_queue() -> Queue:
    return Queue()
