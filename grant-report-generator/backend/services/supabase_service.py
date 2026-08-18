"""Small, backend-only helpers for GrantFlow's Supabase database.

This file uses the Supabase *service key*. Keep that key in the root .env file
and never import this module into the React frontend.
"""

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


# The shared .env file is three folders above this file during local development.
# Railway will provide the same variables as deployment environment variables.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")


class SupabaseConfigurationError(RuntimeError):
    """Raised when a required Supabase setting is missing."""


def get_supabase_client() -> Client:
    """Create a Supabase client using backend-only credentials.

    A new client is inexpensive to create and keeps this first version simple.
    """

    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not service_key:
        raise SupabaseConfigurationError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env."
        )

    return create_client(supabase_url, service_key)


def cache_sheet_data(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Save one fresh Google Sheet result for use if Sheets is unavailable later."""

    response = (
        get_supabase_client()
        .table("sheet_cache")
        .insert({"data": rows, "row_count": len(rows)})
        .execute()
    )
    return response.data[0]


def get_latest_sheet_cache() -> dict[str, Any] | None:
    """Return the newest cached sheet result, or None when no cache exists."""

    response = (
        get_supabase_client()
        .table("sheet_cache")
        .select("*")
        .order("cached_at", desc=True)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def save_report_metadata(
    *,
    generated_by: str,
    report_format: str,
    row_count: int,
    total_received: float,
    total_beneficiaries: int,
    report_url: str | None = None,
) -> dict[str, Any]:
    """Save the summary shown later on the Report History page.

    ``generated_by`` is the UUID of the signed-in Supabase user. The generated
    PDF or Word file URL will be added after Supabase Storage is configured.
    """

    if report_format not in {"PDF", "Word"}:
        raise ValueError("report_format must be either 'PDF' or 'Word'.")

    payload = {
        "generated_by": generated_by,
        "report_url": report_url,
        "format": report_format,
        "row_count": row_count,
        "total_received": total_received,
        "total_beneficiaries": total_beneficiaries,
    }
    response = get_supabase_client().table("reports").insert(payload).execute()
    return response.data[0]


def get_report_history() -> list[dict[str, Any]]:
    """Return reports with newest reports shown first."""

    response = (
        get_supabase_client()
        .table("reports")
        .select("*")
        .order("generated_at", desc=True)
        .execute()
    )
    return response.data


# NEXT STEP: Build sheets_reader.py to fetch and clean rows from the Grants tab.
