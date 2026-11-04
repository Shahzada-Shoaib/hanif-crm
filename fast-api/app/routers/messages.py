import asyncio
import json
import re
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from ..core.security import SESSION_COOKIE, require_user, timestamp_ms
from ..services.auth import session_user
from ..services.access import accessible_connection
from ..services.messages import (
    list_conversation_messages,
    list_conversations,
    mark_conversation_read,
    save_message,
    subscribers,
)
from ..services.meta import graph

router = APIRouter(prefix="/api/whatsapp", tags=["messages"])


@router.get("/conversations")
async def conversations(phoneNumberId: str, limit: int = 50, cursor: str | None = None, search: str = "", user: dict = Depends(require_user)):
    await accessible_connection(user, phoneNumberId)
    try:
        return await list_conversations(phoneNumberId, limit, cursor, search)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.get("/conversations/{contact_id}/messages")
async def conversation_messages(contact_id: str, phoneNumberId: str, limit: int = 50, cursor: str | None = None, user: dict = Depends(require_user)):
    await accessible_connection(user, phoneNumberId)
    if not re.fullmatch(r"[1-9]\d{6,14}", contact_id):
        raise HTTPException(400, "Invalid customer number.")
    try:
        return await list_conversation_messages(phoneNumberId, contact_id, limit, cursor)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/conversations/{contact_id}/read")
async def read_conversation(contact_id: str, phoneNumberId: str, throughMessageId: str | None = None, user: dict = Depends(require_user)):
    await accessible_connection(user, phoneNumberId)
    if not re.fullmatch(r"[1-9]\d{6,14}", contact_id):
        raise HTTPException(400, "Invalid customer number.")
    await mark_conversation_read(phoneNumberId, contact_id, throughMessageId)
    return {"ok": True}


@router.post("/send")
async def send(request: Request, user: dict = Depends(require_user)):
    body = await request.json()
    phone_id = str(body.get("phoneNumberId", ""))
    recipient = re.sub(r"\D", "", str(body.get("to", "")))
    text = str(body.get("text", "")).strip()

    if not _valid_message(phone_id, recipient, text):
        raise HTTPException(400, "Select a linked number, enter a valid recipient and 1–4096 characters.")

    connection = await accessible_connection(user, phone_id, include_token=True)

    result = await graph(
        f"{phone_id}/messages",
        connection["accessToken"],
        "POST",
        {"messaging_product": "whatsapp", "to": recipient, "type": "text", "text": {"body": text}},
    )
    message_id = (result.get("messages") or [{}])[0].get("id")
    if not message_id:
        raise HTTPException(502, "Meta did not return a message ID.")

    message = _outgoing_message(message_id, phone_id, recipient, text)
    await save_message(message, notify=True, source="outgoing")
    return {"ok": True, "message": message}


@router.get("/stream")
async def stream(phoneNumberId: str, session: str | None = Cookie(None, alias=SESSION_COOKIE)):
    user = await session_user(session)
    if not user:
        raise HTTPException(401, "Please sign in.")
    await accessible_connection(user, phoneNumberId)

    queue = asyncio.Queue()
    subscribers.setdefault(phoneNumberId, set()).add(queue)
    return StreamingResponse(
        _events(phoneNumberId, queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _valid_message(phone_id: str, recipient: str, text: str) -> bool:
    return phone_id.isdigit() and bool(re.fullmatch(r"[1-9]\d{6,14}", recipient)) and 1 <= len(text) <= 4096


def _outgoing_message(message_id: str, phone_id: str, recipient: str, text: str) -> dict:
    return {"id": message_id, "phoneNumberId": phone_id, "from": phone_id, "to": recipient, "text": text, "direction": "out", "timestamp": timestamp_ms(), "status": "sent", "error": None}


async def _events(phone_id: str, queue: asyncio.Queue):
    try:
        yield "event: ready\ndata: {}\n\n"
        while True:
            try:
                event, payload = await asyncio.wait_for(queue.get(), 15)
                yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
    finally:
        subscribers.get(phone_id, set()).discard(queue)
