from ..core.security import decrypt_token, encrypt_token, timestamp_ms
from ..database import get_store
from .meta import MetaError, graph
from .tenancy import company_ids_for


def public_connection(row: dict) -> dict:
    return {
        "phoneNumberId": row["phone_number_id"],
        "wabaId": row["waba_id"],
        "displayPhone": row["display_phone"],
        "verifiedName": row["verified_name"],
        "webhookSubscribed": row["webhook_subscribed"],
        "updatedAt": int(row["updated_at"]),
        "companyId": row.get("company_id"),
    }


async def list_connections(user: dict | None = None) -> list[dict]:
    if not user or user["role"] == "super_admin":
        return []
    allowed = await company_ids_for(user)
    rows = await get_store().rows("connections", order="display_phone.asc")
    return [public_connection(row) for row in rows if row.get("status", "active") == "active" and row.get("company_id") in allowed]


async def get_connection(phone_id: str, include_token=False) -> dict | None:
    rows = await get_store().rows("connections", filters={"phone_number_id": f"eq.{phone_id}"}, limit=1)
    if not rows or rows[0].get("status", "active") != "active":
        return None
    connection = public_connection(rows[0])
    if include_token:
        connection["accessToken"] = decrypt_token(rows[0]["encrypted_token"], phone_id)
    return connection


async def import_account(waba_id: str, token: str, company_id: str | None = None) -> dict:
    if not waba_id.isdigit():
        raise ValueError("Invalid account ID.")
    phones, cursor, seen = [], "", set()
    while True:
        suffix = f"&after={cursor}" if cursor else ""
        page = await graph(f"{waba_id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100{suffix}", token)
        phones.extend(page.get("data", []))
        cursor = page.get("paging", {}).get("cursors", {}).get("after", "") if page.get("paging", {}).get("next") else ""
        if not cursor:
            break
        if cursor in seen:
            raise RuntimeError("Invalid pagination cursor.")
        seen.add(cursor)

    subscribed, warning = False, None
    try:
        subscribed = (await graph(f"{waba_id}/subscribed_apps", token, "POST", {})).get("success") is True
    except MetaError as error:
        warning = f"Numbers saved, but webhook subscription failed. {error}"

    store = get_store()
    old_rows = await store.rows("connections", select="phone_number_id,company_id", filters={"waba_id": f"eq.{waba_id}"})
    companies = {row["phone_number_id"]: row.get("company_id") for row in old_rows}
    connections = [{
        "phoneNumberId": phone["id"], "wabaId": waba_id,
        "displayPhone": phone.get("display_phone_number", phone["id"]),
        "verifiedName": phone.get("verified_name", "WhatsApp Business"),
        "webhookSubscribed": subscribed, "updatedAt": timestamp_ms(),
        "companyId": companies.get(phone["id"]) or company_id,
    } for phone in phones]
    if connections:
        await store.insert("connections", [{
            "phone_number_id": item["phoneNumberId"], "waba_id": waba_id,
            "display_phone": item["displayPhone"], "verified_name": item["verifiedName"],
            "encrypted_token": encrypt_token(token, item["phoneNumberId"]),
            "webhook_subscribed": subscribed, "updated_at": item["updatedAt"],
            "company_id": item["companyId"], "status": "active",
        } for item in connections])
    return {"connections": connections, "warning": warning or ("No numbers returned by Meta." if not connections else None)}


async def offboard_connection(phone_id: str, user: dict | None = None) -> list[dict]:
    saved = await get_connection(phone_id, include_token=True)
    if not saved:
        raise ValueError("Connection not found.")

    store = get_store()
    # Fail before touching Meta if the required database migration is missing.
    await store.rows(
        "connections",
        select="phone_number_id,status",
        filters={"phone_number_id": f"eq.{phone_id}"},
        limit=1,
    )

    answer = await graph(
        f"{phone_id}/deregister",
        saved["accessToken"],
        "POST",
    )
    if answer.get("success") is not True:
        raise MetaError("Meta did not confirm that the number was deregistered.")

    await store.update("connections", {
        "status": "disconnected",
        "webhook_subscribed": False,
        "updated_at": timestamp_ms(),
    }, {"phone_number_id": f"eq.{phone_id}"})

    # Reset import workflow state but preserve messages, contacts, and the connection audit row.
    await store.delete("coexistence_requests", {"phone_number_id": f"eq.{phone_id}"})
    await store.delete("history_progress", {"phone_number_id": f"eq.{phone_id}"})
    return await list_connections(user)


async def delete_connection(phone_id: str, user: dict | None = None) -> list[dict]:
    saved = await get_connection(phone_id)
    if not saved:
        raise ValueError("Connection not found.")

    store = get_store()
    filters = {"phone_number_id": f"eq.{phone_id}"}

    # Delete dependent records first; the connection row is removed last.
    await store.delete("history_messages", filters)
    await store.delete("messages", filters)
    await store.delete("contacts", filters)
    await store.delete("coexistence_requests", filters)
    await store.delete("history_progress", filters)
    await store.delete("connections", filters)

    # WABA-level setup records belong to all its numbers, so only remove them
    # when the deleted connection was the final number in that WABA.
    remaining = await store.rows(
        "connections",
        select="phone_number_id",
        filters={"waba_id": f"eq.{saved['wabaId']}"},
        limit=1,
    )
    if not remaining:
        await store.delete("hosted_onboarding", {"waba_id": f"eq.{saved['wabaId']}"})
        await store.delete("account_updates", {"waba_id": f"eq.{saved['wabaId']}"})

    return await list_connections(user)
