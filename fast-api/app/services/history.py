from ..core.security import timestamp_ms
from ..database import get_store
from .connections import get_connection
from .meta import MetaError, graph


async def status(phone_id: str) -> dict:
    store = get_store()
    progress = await store.rows("history_progress", filters={"phone_number_id": f"eq.{phone_id}"}, limit=1)
    requests = await store.rows("coexistence_requests", filters={"phone_number_id": f"eq.{phone_id}"})
    history = next((row for row in requests if row["kind"] == "history"), {})
    contacts = next((row for row in requests if row["kind"] == "smb_app_state_sync"), {})
    saved = await store.rows("history_messages", select="message_id", filters={"phone_number_id": f"eq.{phone_id}"})
    return {
        "status": "receiving" if progress else history.get("status", "not_started"),
        "progress": int(progress[0].get("progress", 0)) if progress else 0,
        "count": len(saved),
        "error": progress[0].get("error") if progress else history.get("error"),
        "contactError": contacts.get("error"),
        "contactStatus": contacts.get("status", "not_started"),
    }


async def start(phone_id: str, retry=False) -> dict:
    saved = await get_connection(phone_id, include_token=True)
    if not saved:
        raise ValueError("Select an imported number first.")
    token = saved["accessToken"]
    if (await graph(f"{phone_id}?fields=is_on_biz_app", token)).get("is_on_biz_app") is not True:
        raise ValueError("Meta has not identified this as a Coexistence number.")
    for kind in ("smb_app_state_sync", "history"):
        await _request_once(phone_id, token, kind, retry)
    return await status(phone_id)


async def _request_once(phone_id: str, token: str, kind: str, retry: bool) -> None:
    store = get_store()
    filters = {"phone_number_id": f"eq.{phone_id}", "kind": f"eq.{kind}"}
    existing = await store.rows("coexistence_requests", filters=filters, limit=1)
    if existing and not (retry and existing[0].get("status") == "failed"):
        return
    if existing:
        await store.delete("coexistence_requests", filters)
    await store.insert("coexistence_requests", {"phone_number_id": phone_id, "kind": kind, "status": "requesting", "request_id": None, "error": None, "updated_at": timestamp_ms()})
    try:
        answer = await graph(f"{phone_id}/smb_app_data", token, "POST", {"messaging_product": "whatsapp", "sync_type": kind})
        update = {"status": "requested" if answer.get("request_id") else "uncertain", "request_id": answer.get("request_id"), "updated_at": timestamp_ms()}
    except MetaError as error:
        update = {"status": "failed", "error": str(error), "updated_at": timestamp_ms()}
    await store.update("coexistence_requests", update, filters)
