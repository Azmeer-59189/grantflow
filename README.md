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
- Built `backend/services/sheets_reader.py` to securely read and clean the Google Sheet's `Grants` tab.

### Not committed on purpose

- `.env` is ignored by Git. It contains local configuration and must never be pushed.
- `SUPABASE_SERVICE_KEY` is still blank. Add the Supabase Secret/service-role key locally before testing the backend.

### Local backend setup

Python 3.14 has been tested with the current dependencies. From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r grant-report-generator\backend\requirements.txt
cd grant-report-generator\backend
uvicorn main:app --reload
```

Open `http://localhost:8000/health` to confirm the API is running. The interactive
API documentation will be available at `http://localhost:8000/docs` as routes are added.

Copy `.env.example` to `.env` and set the required local values before using Supabase
or Google Sheets.

### Remaining build steps

1. Add `SUPABASE_SERVICE_KEY` in `.env` (backend only; never share or commit it), then test `supabase_service.py` against Supabase.
2. Configure Google Sheets access locally:
- Set `GOOGLE_SHEET_ID` to the ID in the Google Sheet URL.
- Set `GOOGLE_SHEET_TAB` to the worksheet tab name (defaults to `Grants`).
   - Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the full service-account JSON, or set `GOOGLE_SERVICE_ACCOUNT_FILE` to its local path.
   - Share the sheet with the service account email address as a Viewer.
3. Test `sheets_reader.py`, then build `backend/services/data_processor.py` to validate the expected grant fields and calculate report totals.
4. Build the authenticated API routes, PDF/Word generators, and React application.

### Demonstration grant schema

For the first functional demo, the `Sheet1` tab uses these columns:

`Grant Name`, `Funder`, `Amount Received`, `Beneficiaries`, `Status`, and
`Date Received`.

Dates may use `YYYY-MM-DD`, `DD/MM/YYYY`, or `MM/DD/YYYY`; amounts may include
currency symbols or commas. The demo routes are `GET /api/grants`,
`GET /api/reports/pdf`, and `GET /api/reports/word`.
