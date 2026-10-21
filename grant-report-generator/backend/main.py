"""GrantFlow's FastAPI application entry point.

Run locally from this directory with:
    uvicorn main:app --reload
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from api.routes import router as grants_router
from api.access import router as access_router


app = FastAPI(
    title="GrantFlow API",
    version="0.1.0",
    description="Internal API for preparing and generating charity grant reports.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(grants_router)
app.include_router(access_router)


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    """Provide a lightweight endpoint for local checks and Railway health probes."""

    return {"status": "ok", "service": "grantflow-api"}
