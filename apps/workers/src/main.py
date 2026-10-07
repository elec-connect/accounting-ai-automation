from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.logging import setup_logging, get_logger
from core.database import get_database
from core.queue import get_queue
from workers.ingestion.email_worker import EmailIngestionWorker
from workers.query.rag_worker import RAGWorker


setup_logging()
logger = get_logger(__name__)

app = FastAPI(title="Accounting AI Automation", version="0.1.0")

email_worker = EmailIngestionWorker()
rag_worker = RAGWorker()


class AskRequest(BaseModel):
    question: str
    user_id: str | None = None


@app.get("/health")
async def health():
    db_ok = True
    queue_ok = get_queue().health()
    try:
        get_database().client.table("documents").select("id").limit(1).execute()
    except Exception:
        db_ok = False
    status = "ok" if (db_ok and queue_ok) else "degraded"
    return JSONResponse(
        status_code=200 if status == "ok" else 503,
        content={"status": status, "database": db_ok, "queue": queue_ok},
    )


@app.post("/webhooks/email")
async def email_webhook(request: Request, x_postmark_signature: str = Header(None)):
    if not x_postmark_signature:
        raise HTTPException(status_code=401, detail="Missing signature")
    raw_body = await request.body()
    try:
        result = email_worker.handle(raw_body, x_postmark_signature)
        return JSONResponse(status_code=200, content=result)
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error("Webhook failed", exc_info=True)
        return JSONResponse(status_code=200, content={"status": "error", "message": str(e)})


@app.post("/api/ask")
async def ask(request: AskRequest):
    try:
        result = rag_worker.ask(request.question, request.user_id)
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error("RAG failed", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
