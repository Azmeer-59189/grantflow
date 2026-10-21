# GrantFlow frontend

React + Vite app for the GrantFlow grants workspace. It talks to the FastAPI
backend in `../backend` and signs users in with Supabase Auth.

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173
```

Set these in the root `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase sign-in and file uploads |
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:8000` |

## Checks

```sh
npm run lint
npm test           # node --test, no network or credentials needed
npm run build
```

## Where things live

- `src/pages/` — one file per screen (Overview/Records, Add/Edit grant, History, Activity, Team access)
- `src/components/AppShell.jsx` — sidebar, mobile menu and page frame shared by every page
- `src/components/ui.jsx` — buttons, cards, status pills, dialogs
- `src/lib/` — logic with tests: report status and amounts (`grantForm.js`), pipeline and timeline
  (`pipeline.js`), "Needs attention" rules (`attention.js`), CSV export (`csv.js`), date parsing (`dates.js`)
