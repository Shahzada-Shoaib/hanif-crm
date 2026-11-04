from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import FRONTEND_ORIGINS
from app.database import connect, disconnect
from app.routers import auth, companies, history, media, messages, onboarding, users, webhook, workspace, workspaces


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect()
    yield
    await disconnect()


app = FastAPI(
    title="Hanif CRM API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(auth.registration_router)
app.include_router(companies.router)
app.include_router(users.router)
app.include_router(workspace.router)
app.include_router(workspaces.router)
app.include_router(messages.router)
app.include_router(media.router)
app.include_router(history.router)
app.include_router(onboarding.router)
app.include_router(webhook.router)


@app.get("/")
async def root():
    return {"name": "Hanif CRM API", "status": "ok"}


@app.get("/api/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
