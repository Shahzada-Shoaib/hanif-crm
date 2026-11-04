import hashlib
import hmac
import os
import re
import time
from base64 import b64decode, b64encode
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Cookie, HTTPException
from .config import setting

SESSION_COOKIE = "crm_session"


def timestamp_ms() -> int:
    return int(time.time() * 1000)


async def require_user(session: str | None = Cookie(None, alias=SESSION_COOKIE)) -> dict:
    from ..services.auth import session_user
    user = await session_user(session)
    if not user:
        raise HTTPException(401, "Please sign in to the CRM.")
    return user


def _encryption_key() -> bytes:
    value = setting("CRM_ENCRYPTION_KEY")
    if not re.fullmatch(r"[a-fA-F0-9]{64}", value):
        raise RuntimeError("Set CRM_ENCRYPTION_KEY to a 64-character hex key.")
    return bytes.fromhex(value)


def encrypt_token(token: str, phone_id: str) -> str:
    nonce = os.urandom(12)
    encrypted = AESGCM(_encryption_key()).encrypt(nonce, token.encode(), phone_id.encode())
    parts = nonce, encrypted[-16:], encrypted[:-16]
    return ".".join(b64encode(part).decode() for part in parts)


def decrypt_token(value: str, phone_id: str) -> str:
    nonce, tag, encrypted = (b64decode(part) for part in value.split("."))
    return AESGCM(_encryption_key()).decrypt(nonce, encrypted + tag, phone_id.encode()).decode()


def valid_webhook_signature(raw: bytes, signature: str) -> bool:
    secret = setting("META_APP_SECRET")
    if not secret:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
