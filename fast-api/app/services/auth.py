import base64
import hashlib
import hmac
import re
import secrets
import uuid

from fastapi import HTTPException

from ..core.config import setting
from ..core.security import timestamp_ms
from ..database import get_store

SESSION_LENGTH_MS = 7 * 24 * 60 * 60 * 1000
USERNAME_PATTERN = re.compile(r"[a-z0-9][a-z0-9._-]{2,49}")


def public_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "role": row["role"],
        "workspaceId": row.get("workspace_id"),
        "createdBy": row.get("created_by"),
        "status": row.get("status", "active"),
        "createdAt": int(row["created_at"]),
    }


def normalize_username(value) -> str:
    return str(value or "").strip().lower()


def validate_username(value) -> str:
    username = normalize_username(value)
    if not USERNAME_PATTERN.fullmatch(username):
        raise HTTPException(400, "Username must be 3-50 characters using letters, numbers, dots, dashes or underscores.")
    return username


def validate_password(value) -> str:
    password = str(value or "")
    if not 8 <= len(password) <= 128:
        raise HTTPException(400, "Password must be between 8 and 128 characters.")
    return password


def password_record(password: str) -> tuple[str, str]:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return base64.b64encode(salt).decode(), base64.b64encode(digest).decode()


def password_matches(password: str, salt_value: str, digest_value: str) -> bool:
    try:
        salt = base64.b64decode(salt_value)
        expected = base64.b64decode(digest_value)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


async def authenticate(username: str, password: str) -> tuple[dict, str]:
    username = normalize_username(username) or "admin"
    await _bootstrap_super_admin(username, password)
    rows = await get_store().rows("crm_users", filters={"username": f"eq.{username}"}, limit=1)
    if not rows or rows[0].get("status") != "active" or not password_matches(password, rows[0]["password_salt"], rows[0]["password_hash"]):
        raise HTTPException(401, "Incorrect username or password.")

    return public_user(rows[0]), await _create_session(rows[0]["id"])


async def register(body: dict) -> tuple[dict, str]:
    username = validate_username(body.get("username"))
    password = validate_password(body.get("password"))
    display_name = str(body.get("displayName") or "").strip()
    workspace_name = str(body.get("workspaceName") or body.get("companyName") or "").strip()
    if not 2 <= len(display_name) <= 60:
        raise HTTPException(400, "Name must be between 2 and 60 characters.")
    if not 2 <= len(workspace_name) <= 60:
        raise HTTPException(400, "Workspace name must be between 2 and 60 characters.")
    if await get_store().rows("crm_users", select="id", filters={"username": f"eq.{username}"}, limit=1):
        raise HTTPException(409, "This username is already in use.")

    workspace_id = str(uuid.uuid4())
    await get_store().insert("workspaces", {
        "id": workspace_id,
        "name": workspace_name,
        "status": "active",
        "created_at": timestamp_ms(),
    })

    salt, digest = password_record(password)
    row = {
        "id": str(uuid.uuid4()),
        "username": username,
        "display_name": display_name,
        "password_salt": salt,
        "password_hash": digest,
        "role": "admin",
        "workspace_id": workspace_id,
        "status": "active",
        "created_by": None,
        "created_at": timestamp_ms(),
    }
    try:
        created = await get_store().insert("crm_users", row)
    except Exception:
        await get_store().delete("workspaces", {"id": f"eq.{workspace_id}"})
        raise
    return public_user(created[0]), await _create_session(created[0]["id"])


async def session_user(token: str | None) -> dict | None:
    if not token:
        return None
    token_hash = _token_hash(token)
    sessions = await get_store().rows("crm_sessions", filters={"token_hash": f"eq.{token_hash}"}, limit=1)
    if not sessions:
        return None
    if int(sessions[0]["expires_at"]) <= timestamp_ms():
        await get_store().delete("crm_sessions", {"token_hash": f"eq.{token_hash}"})
        return None
    users = await get_store().rows("crm_users", filters={"id": f"eq.{sessions[0]['user_id']}"}, limit=1)
    if not users or users[0].get("status") != "active":
        await get_store().delete("crm_sessions", {"token_hash": f"eq.{token_hash}"})
        return None
    if users[0]["role"] != "super_admin":
        workspaces = await get_store().rows("workspaces", select="status", filters={"id": f"eq.{users[0]['workspace_id']}"}, limit=1)
        if not workspaces or workspaces[0]["status"] != "active":
            await get_store().delete("crm_sessions", {"token_hash": f"eq.{token_hash}"})
            return None
    return public_user(users[0])


async def end_session(token: str | None) -> None:
    if token:
        await get_store().delete("crm_sessions", {"token_hash": f"eq.{_token_hash(token)}"})


async def _bootstrap_super_admin(username: str, password: str) -> None:
    existing = await get_store().rows("crm_users", select="id", limit=1)
    if existing:
        return
    configured_password = setting("CRM_ADMIN_PASSWORD")
    configured_username = normalize_username(setting("CRM_ADMIN_USERNAME", default="admin"))
    if username != configured_username or not configured_password or not hmac.compare_digest(password, configured_password):
        return
    salt, digest = password_record(password)
    await get_store().insert("crm_users", {
        "id": str(uuid.uuid4()),
        "username": configured_username,
        "display_name": "Super Admin",
        "password_salt": salt,
        "password_hash": digest,
        "role": "super_admin",
        "workspace_id": None,
        "status": "active",
        "created_by": None,
        "created_at": timestamp_ms(),
    })


async def _create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = timestamp_ms()
    await get_store().insert("crm_sessions", {
        "token_hash": _token_hash(token),
        "user_id": user_id,
        "expires_at": now + SESSION_LENGTH_MS,
        "created_at": now,
    })
    return token


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
