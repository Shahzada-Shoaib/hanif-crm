import re

MEDIA_TYPES = {"audio", "document", "image", "sticker", "video"}
EDIT_TYPES = {"edit", "edited"}
DELETION_TYPES = {"delete", "deleted", "revoke", "revoked"}


def digits(value) -> str:
    """Return only the digits from a phone number."""
    return re.sub(r"\D", "", str(value or ""))


def parse_message(
    raw: dict,
    phone_id: str,
    business_phone: str,
    source: str,
    thread_id: str = "",
) -> dict | None:
    message_id = str(raw.get("id", ""))
    sender = digits(raw.get("from"))
    timestamp = _timestamp(raw.get("timestamp"))

    if not message_id or not sender or not timestamp:
        return None

    direction, contact = _direction(
        source=source,
        sender=sender,
        recipient=digits(raw.get("to")),
        phone_id=phone_id,
        business_phone=business_phone,
        thread_id=thread_id,
    )
    if not direction or not contact:
        return None

    message_type = str(raw.get("type") or "unsupported").lower()
    return {
        "id": message_id,
        "phoneNumberId": phone_id,
        "from": contact if direction == "in" else phone_id,
        "to": phone_id if direction == "in" else contact,
        "text": _message_text(raw),
        "type": message_type,
        "media": _media_metadata(raw, message_type),
        "direction": direction,
        "timestamp": timestamp,
    }


def parse_message_revision(raw: dict) -> dict | None:
    """Parse Meta edit/revoke events without replacing the original message."""
    message_type = str(raw.get("type") or "").lower()
    if message_type not in EDIT_TYPES and message_type not in DELETION_TYPES:
        return None

    content = raw.get(message_type) or {}
    if not isinstance(content, dict):
        content = {}

    original_id = next((str(value) for value in (
        content.get("original_message_id"),
        content.get("revoked_message_id"),
        content.get("deleted_message_id"),
        raw.get("original_message_id"),
        raw.get("revoked_message_id"),
        raw.get("deleted_message_id"),
    ) if value), "")
    if not original_id:
        return None

    timestamp = _timestamp(raw.get("timestamp"))
    if not timestamp:
        return None

    if message_type in EDIT_TYPES:
        edited_message = content.get("message") or {}
        edited_text = str((edited_message.get("text") or {}).get("body") or "").strip()
        if not edited_text:
            return None
        return {"id": original_id, "editedText": edited_text, "editedAt": timestamp}

    return {"id": original_id, "deletedAt": timestamp}


def parse_message_reaction(raw: dict) -> dict | None:
    """Parse a reaction event as an update to its target message."""
    if str(raw.get("type") or "").lower() != "reaction":
        return None

    reaction = raw.get("reaction") or {}
    message_id = str(reaction.get("message_id") or "")
    timestamp = _timestamp(raw.get("timestamp"))
    if not message_id or not timestamp or "emoji" not in reaction:
        return None

    emoji = str(reaction.get("emoji") or "").strip()
    return {"id": message_id, "reactionEmoji": emoji or None, "reactionAt": timestamp}


def _timestamp(value) -> int | None:
    try:
        result = int(value) * 1000
        return result if result > 0 else None
    except (TypeError, ValueError):
        return None


def _direction(
    source: str,
    sender: str,
    recipient: str,
    phone_id: str,
    business_phone: str,
    thread_id: str,
) -> tuple[str, str]:
    if source == "messages":
        return "in", sender

    if source == "smb_message_echoes":
        return "out", recipient

    if source != "history" or not thread_id:
        return "", ""

    if sender == thread_id:
        return "in", thread_id

    if sender in (business_phone, phone_id):
        return "out", thread_id

    return "", ""


def _message_text(message: dict) -> str:
    message_type = str(message.get("type", "Unsupported"))
    content = message.get(message_type) or {}
    interactive = message.get("interactive") or {}

    choices = [
        (message.get("text") or {}).get("body"),
        (message.get("button") or {}).get("text"),
        (interactive.get("button_reply") or {}).get("title"),
        (interactive.get("list_reply") or {}).get("title"),
        content.get("caption"),
        content.get("filename"),
    ]
    return next((text for text in choices if text), f"[{message_type} message]")


def _media_metadata(message: dict, message_type: str) -> dict | None:
    if message_type not in MEDIA_TYPES:
        return None

    content = message.get(message_type) or {}
    media_id = str(content.get("id") or "")
    if not media_id:
        return None

    return {
        "id": media_id,
        "mimeType": str(content.get("mime_type") or "application/octet-stream"),
        "filename": str(content.get("filename") or ""),
        "caption": str(content.get("caption") or ""),
        "sha256": str(content.get("sha256") or ""),
    }
