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


## Grant workflow improvements: rollout order

1. Run `backend/migrations/20261021_roles_audit.sql` in the Supabase SQL Editor. It adds the audit table and restricts writes to the existing `grant-pictures` bucket. Existing permissive storage policies still need to allow editors to upload; the migration adds restrictions rather than granting upload access.
2. Assign your team's write users the trusted `app_metadata.grantflow_role` value `editor` or `admin` through Supabase admin tooling. The migration includes an SQL example using an exact user UUID. Unassigned users default to `viewer`. Do not use user-editable `user_metadata` for permissions. Have users sign out/in after assignment. Admins currently have editor capabilities; role administration remains in Supabase.
3. Deploy the backend, then the frontend. This frontend requires the new `/api/me` endpoint. Keep the schema and backend deployment ahead of the frontend. Without the migration, grant saves fail before changing Sheets; without explicit editor assignment, users can read but cannot save or upload.
4. Run the read-only smoke checker below, then test authenticated workflows using disposable test data in your chosen environment. The checker never writes grants or uploads files. `GRANTFLOW_ACCESS_TOKEN`, if provided through your local environment, enables authenticated read checks; it is never printed.

```powershell
python grant-report-generator/backend/scripts/production_smoke.py
```

Grant forms have collapsible sections, required-field completion, and warnings before browser refresh or internal navigation with unsaved changes. Records support natural/numeric sorting and client-side pagination (10/25/50/100 rows). Up to ten named views are saved per account in the current browser; views do not sync across devices. Dashboard analytics and routes load in separate chunks, with analytics deferred until near the viewport.

`/audit` lists field changes, actor, timestamp, and save status. Audit intent is persisted before writing to Sheets. Since Google Sheets and Supabase cannot share a transaction, connection failures leave `unconfirmed` or `pending` entries for reconciliation against the actual Sheet. A failed audit-finalization request after a successful write returns a success warning rather than inviting a duplicate save. Direct spreadsheet edits are not captured. Concurrent edits still follow the Sheet's last-write-wins behavior.

Viewers can review grants, reports, history, and activity and generate reports. Editors/admins can additionally create/edit grants and upload files. Role checks are enforced by the backend using the current verified Auth user's app metadata, and by the supplied Storage policies, rather than by UI visibility alone.

### Production check record

On October 21, 2026, read-only HTTP checks confirmed the current Vercel `/login` and `/add-grant` routes return 200, Render `/health` returns 200 with status `ok`, and anonymous `/api/grants` returns 401. These checks apply to the previously deployed version. Authenticated workflows and the new migration still require post-deployment verification; no production grant or attachment was changed by these checks.

Frontend checks now include `npm test` for sorting, pagination, and server-rendered form components. Backend tests include viewer/editor/admin access and audited-write failure handling.
