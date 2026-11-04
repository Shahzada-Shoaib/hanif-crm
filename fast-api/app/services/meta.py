from typing import Any
import httpx
from ..core.config import setting


class MetaError(RuntimeError):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


async def graph(path: str, token: str, method="GET", body: Any = None, form=False):
    version = setting("META_GRAPH_VERSION", default="v26.0")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(
                method,
                f"https://graph.facebook.com/{version}/{path}",
                headers={"Authorization": f"Bearer {token}"},
                data=body if form else None,
                json=None if form else body,
            )
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise MetaError("Could not reach Meta. Please try again.") from error

    if not response.is_success or result.get("error"):
        details = result.get("error") or {}
        code = details.get("code")
        subcode = details.get("error_subcode")
        reason = details.get("error_user_msg") or details.get("message")
        if code == 190:
            message = "Meta rejected this access token (190)."
        else:
            identifiers = ", ".join(
                item for item in (
                    f"code {code}" if code else "",
                    f"subcode {subcode}" if subcode else "",
                ) if item
            )
            message = f"Meta request failed{f' ({identifiers})' if identifiers else ''}"
            message += f": {reason}" if reason else "."
        raise MetaError(message, code)
    return result
