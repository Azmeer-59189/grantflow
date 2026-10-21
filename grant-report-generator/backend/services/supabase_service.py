"""Small, backend-only helpers for GrantFlow's Supabase database.

This file uses the Supabase *service key*. Keep that key in the root .env file
and never import this module into the React frontend.
"""

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import Client, create_client


# The shared .env file is three folders above this file during local development.
# Railway will provide the same variables as deployment environment variables.
from config import PROJECT_ROOT



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


# Fallback snapshots: at most one per interval, kept for a limited time, so the
# table stays small. The fallback only uses snapshots up to
# SHEET_CACHE_MAX_AGE_SECONDS old (one day by default).
SNAPSHOT_INTERVAL_SECONDS = 600
SNAPSHOT_RETENTION = timedelta(days=2)
_last_snapshot = 0.0


def cache_sheet_data(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Save a fresh Google Sheet result for use if Sheets is unavailable later.

    Returns None when a snapshot was saved recently enough to skip this one.
    """
    global _last_snapshot
    now = time.monotonic()
    if _last_snapshot and now - _last_snapshot < SNAPSHOT_INTERVAL_SECONDS:
        return None
    client = get_supabase_client()
    response = client.table("sheet_cache").insert({"data": rows, "row_count": len(rows)}).execute()
    _last_snapshot = now
    cutoff = (datetime.now(timezone.utc) - SNAPSHOT_RETENTION).isoformat()
    client.table("sheet_cache").delete().lt("cached_at", cutoff).execute()
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
    grant_number: str | None = None,
    generated_by_email: str | None = None,
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
    extra = {"grant_number": grant_number, "generated_by_email": generated_by_email}
    table = get_supabase_client().table("reports")
    try:
        response = table.insert({**payload, **extra}).execute()
    except APIError as error:
        # Until migration 20261023_report_history_grant.sql runs, the new
        # columns do not exist (PostgREST PGRST204). Save without them.
        if str(error.code) != "PGRST204":
            raise
        logging.warning("reports table lacks grant_number/generated_by_email; run the 20261023 migration")
        response = table.insert(payload).execute()
    return response.data[0]


def get_report_history(limit: int = 200) -> list[dict[str, Any]]:
    """Return the most recent reports, newest first."""

    response = (
        get_supabase_client()
        .table("reports")
        .select("*")
        .order("generated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


def start_audit(*, user, action: str, grant_number: str, before: dict, after: dict) -> str:
    changes = {key: {'before': before.get(key), 'after': value}
               for key, value in after.items() if before.get(key) != value}
    response = get_supabase_client().table('grant_audit').insert({
        'actor_id': str(user.id), 'actor_email': getattr(user, 'email', None),
        'action': action, 'grant_number': grant_number, 'changes': changes,
        'status': 'pending',
    }).execute()
    return str(response.data[0]['id'])


def finish_audit(audit_id: str, status: str) -> None:
    get_supabase_client().table('grant_audit').update({'status': status}).eq('id', audit_id).execute()


def get_grant_audit(grant_number: str | None = None, limit: int = 100, offset: int = 0) -> list:
    query = get_supabase_client().table('grant_audit').select('*').order('created_at', desc=True).order('id')
    if grant_number:
        query = query.eq('grant_number', grant_number)
    return query.range(offset, offset + limit - 1).execute().data
