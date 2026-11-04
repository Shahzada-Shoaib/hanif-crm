import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / "crm-frontend" / ".env.local")


def setting(*names: str, default: str = "") -> str:
    return next((os.getenv(name, "") for name in names if os.getenv(name)), default)


def required(*names: str) -> str:
    value = setting(*names)
    if not value:
        raise RuntimeError(f"Configure {names[0]} on the FastAPI server.")
    return value


FRONTEND_ORIGINS = [
    item.strip()
    for item in setting("FRONTEND_URL", default="http://localhost:5173,http://127.0.0.1:5173").split(",")
    if item.strip()
]
