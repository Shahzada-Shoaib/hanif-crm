from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.security import require_user
from ..services.access import require_role
from ..services.onboarding import reconcile, settings, start_onboarding

router = APIRouter(prefix="/api/whatsapp/hosted", tags=["onboarding"])


@router.get("")
async def get_settings(companyId: str = "", user: dict = Depends(require_user)):
    require_role(user, "admin")
    return await settings(user, companyId)


@router.post("")
async def refresh(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    try:
        return await reconcile(user, str((await request.json()).get("companyId") or ""))
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/start")
async def begin(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    try:
        return await start_onboarding(user, str((await request.json()).get("companyId") or ""))
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
