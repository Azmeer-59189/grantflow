# GrantFlow

GrantFlow is an internal grant-report generator for a charity grants team.

The application source lives in `grant-report-generator/`. We will build it one small, well-commented file at a time.

## Resume notes — August 18, 2026

### Completed

- Created and pushed the GrantFlow repository and requested folder structure.
- Added backend and frontend dependency lists.
- Created the Supabase `reports` and `sheet_cache` tables.
- Configured the Supabase project URL and frontend publishable key locally.
- Built `backend/services/supabase_service.py` for report history and sheet-cache database operations.

### Not committed on purpose

- `.env` is ignored by Git. It contains local configuration and must never be pushed.
- `SUPABASE_SERVICE_KEY` is still blank. Add the Supabase Secret/service-role key locally before testing the backend.

### Next steps when resuming

1. Confirm Python 3.12 finished installing. If needed, restart VS Code or the terminal so the `python` or `py` command is available.
2. Add `SUPABASE_SERVICE_KEY` in `.env` (backend only; never share or commit it).
3. Create a Python virtual environment, install `backend/requirements.txt`, and test `supabase_service.py` against Supabase.
4. Build `backend/services/sheets_reader.py` to fetch the Google Sheet's `Grants` tab.

> The Python installer was started on August 18 but had not completed when this note was written. Verify it before continuing.
