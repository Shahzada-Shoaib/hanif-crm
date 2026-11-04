import hashlib
import hmac
import json
from ..core.config import required, setting
from ..core.security import timestamp_ms
from ..database import get_store
from .connections import import_account, list_connections
from .meta import graph
from .tenancy import can_access_company


async def settings(user: dict, company_id: str | None = None) -> dict:
    filters = {"company_id": f"eq.{company_id}"} if company_id and await can_access_company(user, company_id) else {"company_id": "eq.__none__"}
    rows = await get_store().rows("hosted_onboarding", select="waba_id,status,error", filters=filters, order="updated_at.desc")
    return {"url": _onboarding_url(), "tokenConfigured": bool(_system_token()), "jobs": [{"wabaId": row["waba_id"], "status": row["status"], "error": row.get("error")} for row in rows], "connections": await list_connections(user)}


async def start_onboarding(user: dict, company_id: str) -> dict:
    if not await can_access_company(user, company_id):
        raise ValueError("Select a company from your workspace.")
    url = _onboarding_url()
    if not url:
        raise ValueError("Meta hosted onboarding is not configured.")

    now = timestamp_ms()
    current = await get_store().rows("onboarding_intents", filters={"id": "eq.active"}, limit=1)
    if current and int(current[0]["expires_at"]) > now and current[0]["workspace_id"] != user["workspaceId"]:
        raise ValueError("Another workspace is currently connecting WhatsApp. Try again in a few minutes.")
    if current:
        await get_store().delete("onboarding_intents", {"id": "eq.active"})
    await get_store().insert("onboarding_intents", {
        "id": "active",
        "workspace_id": user["workspaceId"],
        "company_id": company_id,
        "started_at": now,
        "expires_at": now + 15 * 60 * 1000,
    })
    return {"url": url}


async def reconcile(user: dict, company_id: str) -> dict:
    if not await can_access_company(user, company_id):
        raise ValueError("Select a company from your workspace.")
    intents = await get_store().rows("onboarding_intents", filters={"id": "eq.active"}, limit=1)
    intent = intents[0] if intents else None
    if not intent or intent["workspace_id"] != user["workspaceId"] or intent["company_id"] != company_id or int(intent["expires_at"]) <= timestamp_ms():
        raise ValueError("Open Meta onboarding for this company before checking the connection.")
    token = _system_token()
    if token:
        events = await get_store().rows("account_updates", select="payload,received_at", order="received_at.desc")
        jobs = await _discover_jobs(events, int(intent["started_at"]))
        if jobs:
            await _process_job(jobs[0], events, token, company_id)
            await get_store().delete("onboarding_intents", {"id": "eq.active"})
    result = await settings(user, company_id)
    result["connections"] = await list_connections(user)
    return result


def _system_token() -> str:
    return setting("META_SYSTEM_USER_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN")


def _onboarding_url() -> str | None:
    app_id, config_id = setting("META_APP_ID"), setting("META_HOSTED_CONFIG_ID")
    return f"https://business.facebook.com/messaging/whatsapp/onboard/?app_id={app_id}&config_id={config_id}" if app_id.isdigit() and config_id.isdigit() else None


async def _discover_jobs(events: list[dict], started_at: int) -> list[str]:
    jobs = []
    for record in events:
        try:
            if int(record["received_at"]) < started_at:
                continue
            value = json.loads(record["payload"])["value"]
            waba_id = str((value.get("waba_info") or {}).get("waba_id", ""))
            if value.get("event") in ("PARTNER_ADDED", "PARTNER_APP_INSTALLED") and waba_id.isdigit():
                await get_store().insert("hosted_onboarding", {"waba_id": waba_id, "status": "pending", "error": None, "updated_at": timestamp_ms()}, "ignore-duplicates")
                if waba_id not in jobs:
                    jobs.append(waba_id)
        except (KeyError, TypeError, ValueError):
            continue
    return jobs


async def _process_job(waba_id: str, events: list[dict], system_token: str, company_id: str | None) -> None:
    claimed = await get_store().update("hosted_onboarding", {"status": "processing", "updated_at": timestamp_ms()}, {"waba_id": f"eq.{waba_id}", "status": "eq.pending"})
    if not claimed:
        return
    try:
        owner_id = _find_owner(waba_id, events)
        if not owner_id:
            raise RuntimeError("Signed onboarding event is missing the business portfolio ID.")
        secret = required("META_APP_SECRET")
        proof = hmac.new(secret.encode(), system_token.encode(), hashlib.sha256).hexdigest()
        response = await graph(f"{owner_id}/system_user_access_tokens", system_token, "POST", {"appsecret_proof": proof, "fetch_only": "true"}, form=True)
        business_token = response.get("access_token")
        if not business_token:
            raise RuntimeError("Meta did not return a customer business token.")
        imported = await import_account(waba_id, business_token, company_id)
        if not imported["connections"]:
            raise RuntimeError(imported["warning"] or "No phone numbers returned.")
        update = {"status": "complete", "error": None, "company_id": company_id, "updated_at": timestamp_ms()}
    except Exception as error:
        update = {"status": "failed", "error": str(error), "company_id": company_id, "updated_at": timestamp_ms()}
    await get_store().update("hosted_onboarding", update, {"waba_id": f"eq.{waba_id}"})


def _find_owner(waba_id: str, events: list[dict]) -> str:
    for record in events:
        try:
            info = json.loads(record["payload"])["value"].get("waba_info") or {}
            owner_id = str(info.get("owner_business_id", ""))
            if str(info.get("waba_id")) == waba_id and owner_id.isdigit():
                return owner_id
        except (KeyError, TypeError, ValueError):
            continue
    return ""
