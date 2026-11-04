import uuid

from fastapi import HTTPException

from ..core.security import timestamp_ms
from ..database import get_store
from .auth import password_record, public_user, validate_password, validate_username
from .tenancy import company_ids_for


async def list_users(actor: dict) -> list[dict]:
    if actor["role"] != "admin":
        raise HTTPException(403, "Only workspace admins can view users.")
    rows = await get_store().rows("crm_users", filters={"workspace_id": f"eq.{actor['workspaceId']}"}, order="created_at.desc")
    access = await get_store().rows("user_company_access")
    company_ids_by_user: dict[str, list[str]] = {}
    for item in access:
        company_ids_by_user.setdefault(item["user_id"], []).append(item["company_id"])
    return [{**public_user(row), "companyIds": company_ids_by_user.get(row["id"], [])} for row in rows]


async def create_user(actor: dict, body: dict) -> dict:
    if actor["role"] != "admin":
        raise HTTPException(403, "Only company admins can add users.")
    role = "user"
    workspace_id = actor["workspaceId"]
    requested_company_ids = {str(value) for value in body.get("companyIds", []) if value}
    allowed_company_ids = await company_ids_for(actor)
    if not requested_company_ids or not requested_company_ids.issubset(allowed_company_ids):
        raise HTTPException(400, "Select at least one valid company.")

    username = validate_username(body.get("username"))
    password = validate_password(body.get("password"))
    display_name = str(body.get("displayName") or "").strip()
    if not 2 <= len(display_name) <= 60:
        raise HTTPException(400, "Name must be between 2 and 60 characters.")
    if await get_store().rows("crm_users", select="id", filters={"username": f"eq.{username}"}, limit=1):
        raise HTTPException(409, "This username is already in use.")

    salt, digest = password_record(password)
    rows = await get_store().insert("crm_users", {
        "id": str(uuid.uuid4()),
        "username": username,
        "display_name": display_name,
        "password_salt": salt,
        "password_hash": digest,
        "role": role,
        "workspace_id": workspace_id,
        "status": "active",
        "created_by": actor["id"],
        "created_at": timestamp_ms(),
    })
    created = rows[0]
    await get_store().insert("user_company_access", [{
        "user_id": created["id"],
        "company_id": company_id,
        "created_at": timestamp_ms(),
    } for company_id in sorted(requested_company_ids)])
    return {**public_user(created), "companyIds": sorted(requested_company_ids)}


async def set_user_status(actor: dict, user_id: str, status: str) -> dict:
    if status not in ("active", "disabled"):
        raise HTTPException(400, "Invalid user status.")
    rows = await get_store().rows("crm_users", filters={"id": f"eq.{user_id}"}, limit=1)
    if not rows:
        raise HTTPException(404, "User not found.")
    target = public_user(rows[0])
    if target["id"] == actor["id"]:
        raise HTTPException(400, "You cannot disable your own account.")
    if actor["role"] == "admin" and (target["workspaceId"] != actor["workspaceId"] or target["role"] != "user"):
        raise HTTPException(403, "You cannot manage this user.")
    if actor["role"] != "admin":
        raise HTTPException(403, "Only workspace admins can manage users.")

    updated = await get_store().update("crm_users", {"status": status}, {"id": f"eq.{user_id}"})
    if status == "disabled":
        await get_store().delete("crm_sessions", {"user_id": f"eq.{user_id}"})
    return public_user(updated[0])


async def set_user_companies(actor: dict, user_id: str, company_ids: list) -> dict:
    if actor["role"] != "admin":
        raise HTTPException(403, "Only workspace admins can manage access.")
    rows = await get_store().rows("crm_users", filters={"id": f"eq.{user_id}"}, limit=1)
    if not rows or rows[0]["role"] != "user" or rows[0].get("workspace_id") != actor["workspaceId"]:
        raise HTTPException(404, "User not found.")

    requested = {str(value) for value in company_ids if value}
    allowed = await company_ids_for(actor)
    if not requested or not requested.issubset(allowed):
        raise HTTPException(400, "Select at least one valid company.")

    await get_store().delete("user_company_access", {"user_id": f"eq.{user_id}"})
    await get_store().insert("user_company_access", [{
        "user_id": user_id,
        "company_id": company_id,
        "created_at": timestamp_ms(),
    } for company_id in sorted(requested)])
    return {**public_user(rows[0]), "companyIds": sorted(requested)}
