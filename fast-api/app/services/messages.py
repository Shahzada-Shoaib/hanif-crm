import asyncio
import base64
import json
from ..database import get_store
from .media import schedule_media_cache

subscribers: dict[str, set[asyncio.Queue]] = {}


async def publish(phone_id: str, event: str, payload: dict) -> None:
    for queue in subscribers.get(phone_id, set()).copy():
        await queue.put((event, payload))


async def save_message(message: dict, notify=False, source="live") -> None:
    contact_id = message["from"] if message["direction"] == "in" else message["to"]
    delivery_status = "received" if message["direction"] == "in" else "sent"
    result = await get_store().rpc("persist_crm_message", {
        "p_id": message["id"],
        "p_phone_number_id": message["phoneNumberId"],
        "p_contact_id": contact_id,
        "p_sender": message["from"],
        "p_recipient": message["to"],
        "p_body": message["text"],
        "p_direction": message["direction"],
        "p_timestamp": message["timestamp"],
        "p_source": source,
        "p_delivery_status": delivery_status,
    })
    media = message.get("media") or {}
    if media:
        await get_store().update("messages", {
            "message_type": message.get("type", "text"),
            "media_id": media["id"],
            "media_mime_type": media.get("mimeType") or "application/octet-stream",
            "media_filename": media.get("filename") or None,
            "media_caption": media.get("caption") or None,
            "media_sha256": media.get("sha256") or None,
        }, {
            "phone_number_id": f"eq.{message['phoneNumberId']}",
            "id": f"eq.{message['id']}",
        })
        if source in ("live", "history"):
            schedule_media_cache(message["phoneNumberId"], media["id"])
    changed = bool(result and result[0].get("was_changed"))
    if notify and changed:
        message = {**message, "status": delivery_status, "error": None}
        await publish(message["phoneNumberId"], "message", message)


async def update_message_status(phone_id: str, message_id: str, status: str, error: str | None = None) -> None:
    await get_store().update("messages", {
        "delivery_status": status,
        "error": error,
    }, {
        "phone_number_id": f"eq.{phone_id}",
        "id": f"eq.{message_id}",
    })
    await publish(phone_id, "message_status", {
        "id": message_id,
        "status": status,
        "error": error,
    })


async def update_message_reaction(phone_id: str, reaction: dict) -> None:
    filters = {
        "phone_number_id": f"eq.{phone_id}",
        "id": f"eq.{reaction['id']}",
    }
    existing = await get_store().rows(
        "messages",
        select="id,reaction_at",
        filters=filters,
        limit=1,
    )
    if not existing:
        return
    reaction_at = existing[0].get("reaction_at")
    if reaction_at is not None and int(reaction_at) >= reaction["reactionAt"]:
        return

    await get_store().update("messages", {
        "reaction_emoji": reaction["reactionEmoji"],
        "reaction_at": reaction["reactionAt"],
    }, filters)
    await publish(phone_id, "message_reaction", reaction)


async def update_message_revision(phone_id: str, revision: dict) -> None:
    filters = {
        "phone_number_id": f"eq.{phone_id}",
        "id": f"eq.{revision['id']}",
    }
    existing = await get_store().rows(
        "messages",
        select="id,contact_id,body,edited_body,edited_at,deleted_at",
        filters=filters,
        limit=1,
    )
    if not existing:
        return

    current = existing[0]
    changes = {}
    if revision.get("editedText") is not None:
        if current.get("edited_at") is not None and int(current["edited_at"]) >= revision["editedAt"]:
            return
        changes["edited_body"] = revision["editedText"]
        changes["edited_at"] = revision["editedAt"]
    if revision.get("deletedAt") is not None:
        if current.get("deleted_at") is not None and int(current["deleted_at"]) >= revision["deletedAt"]:
            return
        changes["deleted_at"] = revision["deletedAt"]
    if not changes:
        return

    await get_store().update("messages", changes, filters)
    preview = "This message was deleted from WhatsApp" if (
        current.get("deleted_at") is not None or revision.get("deletedAt") is not None
    ) else revision["editedText"]
    await get_store().update("conversations", {
        "last_message_body": preview,
    }, {
        "phone_number_id": f"eq.{phone_id}",
        "last_message_id": f"eq.{revision['id']}",
    })
    await publish(phone_id, "message_revision", revision)


def _encode_cursor(timestamp: int, identifier: str) -> str:
    payload = json.dumps([timestamp, identifier], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(value: str | None) -> tuple[int | None, str | None]:
    if not value:
        return None, None
    try:
        padding = "=" * (-len(value) % 4)
        timestamp, identifier = json.loads(base64.urlsafe_b64decode(value + padding))
        if not isinstance(timestamp, int) or not isinstance(identifier, str) or not identifier:
            raise ValueError
        return timestamp, identifier
    except (ValueError, TypeError, json.JSONDecodeError):
        raise ValueError("Invalid pagination cursor.") from None


async def list_conversations(phone_id: str, limit: int, cursor: str | None, search: str) -> dict:
    before_at, before_contact = _decode_cursor(cursor)
    page_size = max(1, min(limit, 100))
    rows = await get_store().rpc("list_crm_conversations", {
        "p_phone_number_id": phone_id,
        "p_limit": page_size + 1,
        "p_before_at": before_at,
        "p_before_contact": before_contact,
        "p_search": search.strip()[:100],
    })
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    conversations = [{
        "contactId": row["contact_id"],
        "contactName": row["contact_name"],
        "lastMessage": {
            "id": row["last_message_id"],
            "text": row["last_message_body"],
            "direction": row["last_message_direction"],
            "timestamp": int(row["last_message_at"]),
        },
        "unreadCount": int(row["unread_count"]),
        "status": row["status"],
        "assignedUserId": row.get("assigned_user_id"),
    } for row in rows]
    next_cursor = None
    if has_more and rows:
        next_cursor = _encode_cursor(int(rows[-1]["last_message_at"]), rows[-1]["contact_id"])
    return {"conversations": conversations, "nextCursor": next_cursor}


async def list_conversation_messages(phone_id: str, contact_id: str, limit: int, cursor: str | None) -> dict:
    before_at, before_id = _decode_cursor(cursor)
    page_size = max(1, min(limit, 100))
    rows = await get_store().rpc("list_crm_conversation_messages", {
        "p_phone_number_id": phone_id,
        "p_contact_id": contact_id,
        "p_limit": page_size + 1,
        "p_before_at": before_at,
        "p_before_id": before_id,
    })
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    messages = [{
        "id": row["id"],
        "phoneNumberId": row["phone_number_id"],
        "from": row["sender"],
        "to": row["recipient"],
        "text": row["body"],
        "type": row.get("message_type") or "text",
        "media": ({
            "id": row["media_id"],
            "mimeType": row.get("media_mime_type") or "application/octet-stream",
            "filename": row.get("media_filename") or "",
            "caption": row.get("media_caption") or "",
            "sha256": row.get("media_sha256") or "",
        } if row.get("media_id") else None),
        "direction": row["direction"],
        "timestamp": int(row["timestamp"]),
        "status": row["delivery_status"],
        "error": row.get("error"),
        "editedText": row.get("edited_body"),
        "editedAt": int(row["edited_at"]) if row.get("edited_at") is not None else None,
        "deletedAt": int(row["deleted_at"]) if row.get("deleted_at") is not None else None,
        "reactionEmoji": row.get("reaction_emoji"),
        "reactionAt": int(row["reaction_at"]) if row.get("reaction_at") is not None else None,
    } for row in reversed(rows)]
    next_cursor = None
    if has_more and rows:
        oldest = rows[-1]
        next_cursor = _encode_cursor(int(oldest["timestamp"]), oldest["id"])
    return {"messages": messages, "nextCursor": next_cursor}


async def mark_conversation_read(phone_id: str, contact_id: str, through_message_id: str | None) -> None:
    await get_store().rpc("mark_crm_conversation_read", {
        "p_phone_number_id": phone_id,
        "p_contact_id": contact_id,
        "p_last_message_id": through_message_id,
    })
