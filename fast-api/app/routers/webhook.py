import json
import hmac
import logging
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from ..core.config import setting
from ..core.security import valid_webhook_signature
from ..services.webhook import ingest

router = APIRouter(tags=["webhook"])
logger = logging.getLogger("uvicorn.error")


@router.get("/api/whatsapp/webhook")
@router.get("/webhook")
async def verify(
    mode: str | None = Query(None, alias="hub.mode"),
    token: str | None = Query(None, alias="hub.verify_token"),
    challenge: str | None = Query(None, alias="hub.challenge"),
):
    configured = setting("WHATSAPP_VERIFY_TOKEN")
    if configured and mode == "subscribe" and hmac.compare_digest(token or "", configured):
        logger.info("WhatsApp webhook verification succeeded")
        return PlainTextResponse(challenge or "")
    logger.warning("WhatsApp webhook verification failed (mode=%s)", mode)
    raise HTTPException(403, "Verification failed")


@router.post("/api/whatsapp/webhook")
@router.post("/webhook")
async def receive(request: Request):
    raw = await request.body()
    logger.info("WhatsApp webhook received: %s", raw.decode("utf-8", errors="replace"))
    if not setting("META_APP_SECRET"):
        logger.error("WhatsApp webhook rejected: META_APP_SECRET is not configured")
        raise HTTPException(503, "Webhook signing is not configured.")
    if not valid_webhook_signature(raw, request.headers.get("x-hub-signature-256", "")):
        logger.warning("WhatsApp webhook rejected: invalid signature")
        raise HTTPException(401, "Invalid signature.")
    try:
        body = json.loads(raw)
    except ValueError as error:
        logger.warning("WhatsApp webhook rejected: invalid JSON")
        raise HTTPException(400, "Invalid JSON.") from error
    if body.get("object") != "whatsapp_business_account":
        logger.info("WhatsApp webhook response: ignored (object=%s)", body.get("object"))
        return {"status": "ignored"}
    try:
        await ingest(body)
    except Exception:
        logger.exception("WhatsApp webhook processing failed")
        raise
    logger.info("WhatsApp webhook response: ok")
    return {"status": "ok"}
