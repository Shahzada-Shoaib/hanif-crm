from fastapi import HTTPException

from .connections import get_connection
from .tenancy import can_access_company


def require_role(user: dict, *roles: str) -> None:
    if user["role"] not in roles:
        raise HTTPException(403, "You do not have permission to perform this action.")


async def accessible_connection(user: dict, phone_id: str, include_token=False) -> dict:
    connection = await get_connection(phone_id, include_token=include_token)
    if not connection or not await can_access_company(user, connection.get("companyId")):
        raise HTTPException(404, "WhatsApp number not found.")
    return connection
