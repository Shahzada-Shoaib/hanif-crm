from fastapi import APIRouter, Cookie, Request, Response
from ..core.security import SESSION_COOKIE
from ..services.auth import authenticate, end_session, register, session_user

router = APIRouter(prefix="/api/session", tags=["session"])
registration_router = APIRouter(tags=["session"])


@registration_router.post("/api/register", status_code=201)
async def create_account(request: Request, response: Response):
    user, token = await register(await request.json())
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=request.url.scheme == "https", max_age=604800)
    return {"ok": True, "user": user}


@router.get("")
async def session(value: str | None = Cookie(None, alias=SESSION_COOKIE)):
    user = await session_user(value)
    return {"authenticated": bool(user), "user": user}


@router.post("")
async def login(request: Request, response: Response):
    body = await request.json()
    user, token = await authenticate(body.get("username", ""), str(body.get("password", "")))
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=request.url.scheme == "https", max_age=604800)
    return {"ok": True, "user": user}


@router.delete("")
async def logout(response: Response, value: str | None = Cookie(None, alias=SESSION_COOKIE)):
    await end_session(value)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}
