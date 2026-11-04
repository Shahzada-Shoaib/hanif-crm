from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.security import require_user
from ..services.access import accessible_connection, require_role
from ..services.history import start, status

router = APIRouter(prefix="/api/whatsapp/history", tags=["history"])


@router.get("")
async def get_history(phoneNumberId: str, user: dict = Depends(require_user)):
    await accessible_connection(user, phoneNumberId)
    return await status(phoneNumberId)


@router.post("")
async def request_history(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    body = await request.json()
    await accessible_connection(user, body.get("phoneNumberId", ""))
    try:
        return await start(body.get("phoneNumberId", ""), body.get("retry") is True)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
