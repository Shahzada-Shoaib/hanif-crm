import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.security import require_user, timestamp_ms
from ..database import get_store
from ..services.access import accessible_connection, require_role
from ..services.tenancy import company_rows_for, can_access_company

router = APIRouter(prefix="/api/companies", tags=["companies"])


def public_company(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "createdAt": int(row["created_at"])}


@router.get("")
async def list_companies(user: dict = Depends(require_user)):
    rows = await company_rows_for(user)
    return {"companies": [public_company(row) for row in rows]}


@router.post("", status_code=201)
async def create_company(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    name = str((await request.json()).get("name", "")).strip()
    if not 2 <= len(name) <= 60:
        raise HTTPException(400, "Company name must be between 2 and 60 characters.")
    try:
        rows = await get_store().insert("companies", {"id": str(uuid.uuid4()), "workspace_id": user["workspaceId"], "name": name, "created_at": timestamp_ms()})
    except RuntimeError as error:
        raise HTTPException(400, "A company with this name already exists.") from error
    return {"company": public_company(rows[0])}


@router.patch("")
async def assign_company(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    body = await request.json()
    phone_id = body.get("phoneNumberId", "")
    company_id = body.get("companyId")
    await accessible_connection(user, phone_id)
    if not await can_access_company(user, company_id):
        raise HTTPException(404, "Company not found.")
    await get_store().update("connections", {"company_id": company_id}, {"phone_number_id": f"eq.{phone_id}"})
    return {"ok": True}
