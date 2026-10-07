"""Daemon qui consomme les 3 queues en boucle."""
import time
from core.logging import setup_logging, get_logger
from core.queue import (
    get_queue,
    QUEUE_EXTRACTION,
    QUEUE_REASONING,
    QUEUE_DELIVERY,
)
from workers.extraction.llm_extract_worker import LLMExtractWorker
from workers.reasoning.rules_worker import RulesWorker
from workers.delivery.xero_delivery_worker import XeroDeliveryWorker


setup_logging()
logger = get_logger("worker_daemon")

QUEUES = [
    (QUEUE_EXTRACTION, "extraction", LLMExtractWorker),
    (QUEUE_REASONING, "reasoning", RulesWorker),
    (QUEUE_DELIVERY, "delivery", XeroDeliveryWorker),
]


def main():
    logger.info("Worker daemon starting...")

    queue = get_queue()
    workers = {}

    for queue_name, worker_name, worker_class in QUEUES:
        workers[queue_name] = worker_class()
        logger.info(f"Worker ready: {worker_name}", extra={"extra_queue": queue_name})

    logger.info(f"Listening on {len(QUEUES)} queues")

    while True:
        try:
            processed = False

            for queue_name, worker_name, _ in QUEUES:
                job = queue.pop(queue_name, timeout=1)
                if job is None:
                    continue

                processed = True

                logger.info(f"[{worker_name}] Job received", extra={
                    "extra_document_id": job.get("document_id"),
                })

                result = workers[queue_name].handle(job)

                logger.info(f"[{worker_name}] Job processed", extra={
                    "extra_document_id": result.get("document_id"),
                    "extra_status": result.get("status"),
                })

            if not processed:
                time.sleep(0.5)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error("Job failed", extra={"extra_error": str(e)}, exc_info=True)
            time.sleep(1)


if __name__ == "__main__":
    main()
