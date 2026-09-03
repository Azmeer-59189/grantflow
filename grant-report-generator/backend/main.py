"""GrantFlow's FastAPI application entry point.

Run locally from this directory with:
    uvicorn main:app --reload
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as grants_router


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="GrantFlow API",
    version="0.1.0",
    description="Internal API for preparing and generating charity grant reports.",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(grants_router)


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    """Provide a lightweight endpoint for local checks and Railway health probes."""

    return {"status": "ok", "service": "grantflow-api"}
