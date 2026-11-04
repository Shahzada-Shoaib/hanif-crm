from fastapi import APIRouter, Depends, Request

from ..core.security import require_user
from ..services.users import create_user, list_users, set_user_companies, set_user_status

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def users(user: dict = Depends(require_user)):
    return {"users": await list_users(user)}


@router.post("", status_code=201)
async def add_user(request: Request, user: dict = Depends(require_user)):
    return {"user": await create_user(user, await request.json())}


@router.patch("/{user_id}")
async def update_user(user_id: str, request: Request, user: dict = Depends(require_user)):
    return {"user": await set_user_status(user, user_id, str((await request.json()).get("status") or ""))}


@router.put("/{user_id}/companies")
async def update_user_companies(user_id: str, request: Request, user: dict = Depends(require_user)):
    body = await request.json()
    return {"user": await set_user_companies(user, user_id, body.get("companyIds") or [])}
