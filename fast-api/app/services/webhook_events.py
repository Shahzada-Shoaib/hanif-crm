import hashlib
import json
from ..core.security import timestamp_ms
from ..database import get_store
from .message_parser import digits, parse_message, parse_message_reaction, parse_message_revision
from .messages import publish, save_message, update_message_reaction, update_message_revision, update_message_status


async def save_account_update(entry: dict, value: dict) -> None:
    info = value.get("waba_info") or {}
    waba_id = str(info.get("waba_id") or entry.get("id", ""))
    if not waba_id.isdigit():
        return

    # Meta can send the same PARTNER_ADDED payload again when a previously
    # disconnected WABA is reconnected. Its entry timestamp distinguishes the
    # new onboarding event from a retry of the original delivery.
    payload = json.dumps({
        "waba_id": waba_id,
        "entry_time": entry.get("time"),
        "value": value,
    }, separators=(",", ":"))
    row = {
        "event_hash": hashlib.sha256(payload.encode()).hexdigest(),
        "waba_id": waba_id,
        "payload": payload,
        "received_at": timestamp_ms(),
    }
    created = await get_store().insert("account_updates", row, "ignore-duplicates")

    if created and value.get("event") in ("PARTNER_ADDED", "PARTNER_APP_INSTALLED"):
        await _create_onboarding_job(waba_id)


async def save_live_messages(value: dict, source: str, phone_id: str, business_phone: str) -> None:
    collection = "message_echoes" if source == "smb_message_echoes" else "messages"

    for raw_message in value.get(collection, []):
        reaction = parse_message_reaction(raw_message)
        if reaction:
            await update_message_reaction(phone_id, reaction)
            continue
        revision = parse_message_revision(raw_message)
        if revision:
            await update_message_revision(phone_id, revision)
            continue
        message = parse_message(raw_message, phone_id, business_phone, source)
        if message:
            await save_message(message, notify=True, source="live")

    for status in value.get("statuses", []):
        delivery_status = str(status.get("status", ""))
        if delivery_status not in ("sent", "delivered", "read", "failed"):
            continue
        message_id = str(status.get("id", ""))
        if not message_id:
            continue
        reason = None
        if delivery_status == "failed":
            errors = status.get("errors") or []
            first_error = errors[0] if errors else {}
            details = (first_error.get("error_data") or {}).get("details")
            reason = str(details or first_error.get("message") or first_error.get("title") or "WhatsApp could not deliver this message.")
        await update_message_status(phone_id, message_id, delivery_status, reason)


async def save_history(value: dict, phone_id: str, business_phone: str) -> None:
    for chunk in value.get("history", []):
        await _save_history_progress(phone_id, chunk)

        for thread in chunk.get("threads", []):
            await _save_history_thread(phone_id, business_phone, thread)

    await publish(phone_id, "refresh", {})


async def save_contacts(value: dict, phone_id: str) -> None:
    store = get_store()
    for state in value.get("state_sync", []):
        row = _contact_row(state, phone_id)
        if not row:
            continue

        if row["status"] == "deleted":
            filters = {
                "phone_number_id": f"eq.{phone_id}",
                "contact_id": f"eq.{row['contact_id']}",
            }
            existing = await store.rows("contacts", select="contact_id", filters=filters, limit=1)
            if existing:
                await store.update("contacts", {
                    "status": "deleted",
                    "timestamp": row["timestamp"],
                }, filters)
                continue

        await store.insert("contacts", row)

    await publish(phone_id, "refresh", {})


async def _create_onboarding_job(waba_id: str) -> None:
    row = {
        "waba_id": waba_id,
        "status": "pending",
        "error": None,
        "updated_at": timestamp_ms(),
    }
    await get_store().insert("hosted_onboarding", row)


async def _save_history_progress(phone_id: str, chunk: dict) -> None:
    metadata = chunk.get("metadata") or {}
    progress = max(0, min(100, int(metadata.get("progress", 0))))
    row = {
        "phone_number_id": phone_id,
        "progress": progress,
        "error": None,
        "updated_at": timestamp_ms(),
    }
    await get_store().insert("history_progress", row)


async def _save_history_thread(phone_id: str, business_phone: str, thread: dict) -> None:
    thread_id = digits(thread.get("id"))

    for raw_message in thread.get("messages", []):
        message = parse_message(
            raw_message,
            phone_id,
            business_phone,
            source="history",
            thread_id=thread_id,
        )
        if not message:
            continue

        await save_message(message, source="history")
        await get_store().insert(
            "history_messages",
            {"phone_number_id": phone_id, "message_id": message["id"]},
            "ignore-duplicates",
        )


def _contact_row(state: dict, phone_id: str) -> dict | None:
    contact = state.get("contact") or {}
    contact_id = digits(contact.get("phone_number"))

    if state.get("type") != "contact" or not contact_id:
        return None

    deleted = state.get("action") in ("remove", "delete")
    name = "" if deleted else contact.get("full_name") or contact.get("first_name") or ""
    metadata = state.get("metadata") or {}
    raw_timestamp = int(metadata.get("timestamp", 0))
    timestamp = raw_timestamp if raw_timestamp >= 1_000_000_000_000 else raw_timestamp * 1000

    return {
        "phone_number_id": phone_id,
        "contact_id": contact_id,
        "name": name,
        "status": "deleted" if deleted else "active",
        "timestamp": timestamp,
    }
