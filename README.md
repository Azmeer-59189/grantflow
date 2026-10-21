# GrantFlow

Internal grant management and report generation for the charity grants team.

React/Vite frontend (Vercel) -> authenticated FastAPI backend (Docker on Render or Railway) -> Google Sheets. Supabase provides login, file uploads, report history, and fallback sheet snapshots.

## Local setup

Copy `.env.example` to the repository-root `.env` and fill in values. Deployment variables take priority; a backend-local `.env` takes priority over the root file. Never commit secrets.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r grant-report-generator/backend/requirements-dev.txt
cd grant-report-generator/backend
..\..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

In another terminal:

```powershell
cd grant-report-generator/frontend
npm ci
# Copy ONLY the three VITE_* values to frontend/.env; Vite reads that directory.
npm run dev
```

Share the Google Sheet with the service-account email as an **Editor** for grant creation/editing. Set `GOOGLE_SHEET_TAB` to the real worksheet name. The 55-column sheet order is defined in `backend/services/sheets_writer.py`.

## Production deployment

Vercel project root: `grant-report-generator/frontend`. Build: `npm run build`. Output: `dist`. The included rewrite supports direct navigation to application routes.

Set these variables in Vercel and redeploy:

- `VITE_API_URL`: the HTTPS backend origin without a trailing slash.
- `VITE_SUPABASE_URL`: your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: your publishable/anon key, never the service-role key.

Backend service root: `grant-report-generator/backend`. Use its **Dockerfile** to install LibreOffice and fonts for template PDFs. Included Render and Railway settings now select Docker. Confirm an existing service actually uses Docker and rebuild it; repository changes alone do not change its dashboard settings.

Set these backend environment variables:

- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`: backend database access for history/cache.
- `SUPABASE_ANON_KEY`: optional publishable/anon key for token verification; defaults to the backend service key.
- `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_TAB`, `GOOGLE_SERVICE_ACCOUNT_JSON`: the full service-account JSON. Alternatively mount a credentials file and set `GOOGLE_SERVICE_ACCOUNT_FILE`.
- `FRONTEND_URL`: your exact Vercel/custom-domain origin. Multiple allowed origins are comma-separated. Explicitly add any preview origins you need.
- `SHEET_CACHE_MAX_AGE_SECONDS`: optional snapshot age limit, default 86400 seconds.

Compare existing Supabase `reports` and `sheet_cache` columns with `backend/schema.sql`. Run that script for missing tables and backend-only access grants. It preserves existing tables and does not migrate incompatible columns. Report generation requires a successful history write, so configure the tables and service key before rollout.

Set the production frontend URL in Supabase Auth and provision team users. Disable public signups for this internal application: all valid authenticated project users can access grants. Uploads retain the existing `grant-pictures` bucket; verify upload policies and public-file behavior suit your team.

Deploy frontend and backend together: requests now require `Authorization: Bearer <Supabase access token>`. Existing frontends without these headers will receive 401 after the backend update. `/health` remains public.

## Reports and fallback data

Complete reports use chapter templates when available. Excluding a section uses the standard Word/PDF layout so selections are honored. Template PDFs require LibreOffice; standard PDFs use ReportLab.

Downloads use unique temporary directories removed after delivery, including intermediate Word files. `/history` records generation metadata; files are not permanently retained or available for re-download there.

Invalid numeric sheet rows return a visible 422 error instead of disappearing from totals. Successful dashboard reads save snapshots. During a Sheets outage, a recent valid snapshot is labeled with a timestamp warning. Editing and report generation require fresh reads. Periodically prune older `sheet_cache` snapshots according to your retention policy.

## Verification

```powershell
cd grant-report-generator/backend
..\..\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ../frontend
npm run lint
npm run build
```

Tests mock external services and do not touch production data. After deployment, smoke-test login, grants, uploads, history, and chapter-template PDFs against the actual services.
