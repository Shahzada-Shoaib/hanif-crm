from collections.abc import Iterator
import logging
from .connections import get_connection
from .message_parser import digits
from .webhook_events import (
    save_account_update,
    save_contacts,
    save_history,
    save_live_messages,
)

logger = logging.getLogger("uvicorn.error")


async def ingest(body: dict) -> None:
    """Send every Meta change to its small, dedicated handler."""
    for entry, change in _changes(body):
        await _handle_change(entry, change)


def _changes(body: dict) -> Iterator[tuple[dict, dict]]:
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            yield entry, change


async def _handle_change(entry: dict, change: dict) -> None:
    value = change.get("value") or {}
    field = _field_name(change, value)

    if field == "account_update":
        await save_account_update(entry, value)
        return

    metadata = value.get("metadata") or {}
    phone_id = str(metadata.get("phone_number_id", ""))
    if not phone_id.isdigit():
        return

    business_phone = digits(metadata.get("display_phone_number"))

    if field in ("messages", "smb_message_echoes"):
        if not await get_connection(phone_id):
            logger.warning(
                "Ignoring WhatsApp %s event for unimported phone number ID %s",
                field,
                phone_id,
            )
            return
        await save_live_messages(value, field, phone_id, business_phone)
        return

    if field == "history":
        await save_history(value, phone_id, business_phone)
        return

    if field == "smb_app_state_sync":
        await save_contacts(value, phone_id)


def _field_name(change: dict, value: dict) -> str:
    if change.get("field"):
        return str(change["field"])
    if isinstance(value.get("messages"), list):
        return "messages"
    return ""
