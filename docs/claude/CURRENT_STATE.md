# RescueConnect — Current State

Last verified: 2026-10-25 against `development` @ `c9ce45b` plus uncommitted fixes from the first fix pass (see `WORKLOG.md`). Facts below were read from source unless marked **Unverified**.

## Top-level layout
| Path | What it is |
|---|---|
| `backend/` | Django 5.2.8 + DRF 3.16.1 API. Project package `tabangnegrosproj/`, single app `reports/`. Local venv `backend/virt` (gitignored, Python 3.14.6). |
| `frontend/` | **Current** Next.js 16.3.4 / React 19.2.8 / TS strict / Tailwind v4 app (`src/app`, `src/components`). |
| `frontend_legacy/` | Old Vite + React + Capacitor app (citizen `App.jsx`, `AdminDashboard.jsx`, `Login.jsx`). Kept for reference. |
| `backend/staticfiles/` | Leftover committed Vite build of the legacy app, no longer routed (`/index.html` and `/assets/...` are still reachable through WhiteNoise; deleting them is proposal P8). `sw.js` here is now a self-removing worker that repairs browsers holding the old one: keep it at this address. |
| `docs/` | Older planning docs (`frontend-codebase-analysis.md` is **stale**: describes `frontend/` as Vite). `docs/claude/` = these notes. |
| `.agents/rules/rescueconnect.md` | Project rules for agents. |
| `instructions.txt`, `README.md`, `backend/README.md` | Legacy TabangNegros docs (SQLite claim, Vite ports, `.env.example` are wrong for this repo). |

## Entry points
- Backend: `backend/manage.py`; settings `backend/tabangnegrosproj/settings.py`; URLs `tabangnegrosproj/urls.py`, `reports/urls.py`; views `reports/views.py`; model `reports/models.py`; serializer `reports/serializers.py`.
- Frontend: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx` (only route; client-side view state machine).

## API endpoints (`backend/reports/urls.py`, mounted at `/api/reports/`)
| Route | View | Notes |
|---|---|---|
| POST `send/` | `EmergencyReportCreateView` | **public** (no auth, ignores credentials); multipart; photo1/photo2 optional (0–2), 5 MB each, PIL JPEG/PNG check; status forced to `pending`; response includes `tracking_code`; 10/hour throttle (own counter) |
| GET `status/<code>/` | `report_status` | **public**, no auth; tracking code is the credential (typed loosely: case, dashes, spaces, O/0, I/L/1 are tolerated); returns only `tracking_code`, `report_type`, `report_type_label`, `status`, `status_label`, `submitted_at`, `updated_at`, `resolved_at`; 404 for unknown/malformed codes; `Cache-Control: no-store`; 300/min throttle (own counter) |
| GET `all/` | `EmergencyReportListView` | staff only; unpaginated |
| PUT/PATCH `update/<pk>/` | `EmergencyReportUpdateView` | staff only; all fields writable |
| GET `active/` | `get_active_reports` | staff only; pending/acknowledged/responding |
| GET `nearby/?lat&lng&radius` | `get_reports_by_area` | staff only; bounding box, default 50 km; 400 on invalid params |
| PATCH `<id>/status/` | `update_report_status` | staff only; status must be one of the model choices (400 otherwise) |
| POST `auth/login/` | `admin_login` | public; `is_staff` only; returns DRF token; 10/min throttle |
| POST `auth/logout/` | `admin_logout` | requires a valid token; deletes it |

Default permission is `IsAdminUser` (`settings.py` `REST_FRAMEWORK`); a missing/invalid token gives 401, a non-staff user 403.

Other: `/admin/` (Django admin; `EmergencyReport` is **not registered**), `/health/`, `/media/<path>` (Django `serve`), `/` redirects to `/admin/`. The old `serve_react` catch-all is gone: `/admin` redirects to `/admin/` and unknown addresses return 404.

## Django admin (staff portal) — `/admin/`
- Custom site `tabangnegrosproj/admin_site.py` (`RescueConnectAdminSite`, wired by `admin_config.py` in `INSTALLED_APPS` instead of `django.contrib.admin`): branding, "Operations Dashboard" (counts, status cards, 8 recent reports), `site_url = None` (no "View site" link).
- Templates (`backend/templates/admin/`, first in `TEMPLATES['DIRS']`): `base_site.html` (header/footer), `login.html` (two-panel sign-in), `index.html` (dashboard; extends the stock index so the app list and "Recent actions" stay), `rescueconnect/emblem.html`.
- Styling: `backend/reports/static/rescueconnect/admin.css` (overrides Django's CSS variables; light and dark; responsive). No external fonts or images.
- Roles (Django Groups, created by a `post_migrate` hook in `reports/apps.py` via `reports/roles.py`): **Responder** = view/change reports; **LGU Administrator** = Responder + view/add/change users (no delete). Superusers act as LGU administrators.
- `reports/admin.py`: `RescueConnectUserAdmin` (Role dropdown on the add form; LGU admins see only Responder accounts, can only create Responders, cannot grant permissions/superuser, cannot delete; server-side forced) and `EmergencyReportAdmin` (status badge, type, message, photo count, map link, type filter; photos shown as read-only thumbnails; Responders may change **only** status).
- Report type is read from the message prefix (`reports/dashboard.py`); there is still no `report_type` field.
- **Offline reporting (D27):** `lib/outbox.ts` (IndexedDB store), `lib/outboxSync.ts` (sender), `lib/retry.ts` (timing), `lib/api.ts` (`submitReport` saves first, then sends; `postReport` is one attempt), `components/outbox/OutboxBanner.tsx` (mounted in `app/layout.tsx`: sends saved reports and shows what is waiting), `components/outbox/SubmissionQueued.tsx` ("saved, NOT sent" screen), `components/reports/OfflineNotice.tsx`, `lib/useOnlineStatus.ts`; `public/sw.js` + `public/offline.html` + `app/manifest.ts` + icons (`public/icon-*.png`, `app/icon.png`, `app/apple-icon.png`); map pin images in `public/leaflet/`. **The service worker is registered only in production builds**, so to try offline mode locally run `npm run build && npm run start` (it needs `localhost` or HTTPS; a phone on `http://<lan-ip>` can still save and resend reports but cannot open the app offline).
- **Time format (D26):** 12-hour with AM/PM everywhere. Django admin and templates follow `tabangnegrosproj/formats/en/formats.py` (e.g. `Oct. 25, 2026, 10:15 PM`; time inputs show/accept 12-hour); the staff live-notification label and dashboard table use `g:i A`; account `last_login`/`date_joined` are read-only for everyone (no 24-hour inputs).
- Optional env vars: `RESCUECONNECT_LGU_NAME` (shown in the header and login page); `RESCUECONNECT_LIVE_POLL_SECONDS` (default 8, minimum 3).
- **Live updates (D21):** `GET /admin/live-reports/` (admin session, needs `reports.view_emergencyreport`; 302 to login if anonymous, 403 without access, 405 for non-GET). `live.js` is loaded on every admin page for permitted staff; the bell/sound controls live in the header (`templates/admin/base_site.html`). Sound only plays after the user has clicked on the page (browser rule) and can be switched off (stored per browser). Notification counts and the baseline are kept per browser tab, so reports that arrived while no tab was open do not trigger toasts.
- Tests: `reports/tests_admin.py`.

## Model: `EmergencyReport`
`latitude`, `longitude` (Float), `accuracy` (nullable), `message` (blank OK), `device_id` (required), `status` (default `pending`), `created_at`, `updated_at`, `tracking_code` (unique, secret, auto-generated; migrations 0005–0007 add it and fill existing rows), `resolved_at` (nullable; maintained by `save()`; migration 0008, backfilled for already-resolved reports), `client_ref` (unique idempotency key from the phone) and `reported_at` (when the citizen made it, by their device clock; migration 0009; both write-only in the API), `photo1`, `photo2` (`CloudinaryField`, folder `tabang_negros/reports`), properties `photo1_url`/`photo2_url`. Ordered `-created_at`. No other models; no custom User.

## Citizen flow as implemented (`frontend/`)
`page.tsx` state: onboarding → dashboard → flood-form | urgent-form → success.
- `OnboardingFlow.tsx`: 5 slides; slide 1 requests geolocation; completion in `localStorage` (`rescueconnect_onboarding_complete`).
- `MapDashboard.tsx`: geolocates on mount (fallback Bacolod 10.6653, 122.9546); `SearchLocation.tsx` (Nominatim, direct from browser); `MapComponent.tsx` (react-leaflet, draggable marker, OSM tiles, loaded via `next/dynamic` ssr:false).
- `FloodReportForm.tsx` / `UrgentResponseForm.tsx`: photos optional, up to 2 (`ImageUploader.tsx`, JPG/PNG, 5 MB, inline errors); Urgent requires a message. Both call `submitReport()` in `frontend/src/lib/api.ts`, which posts to `${NEXT_PUBLIC_API_URL}/reports/send/` (dev fallback `http://127.0.0.1:8000/api` only when `NODE_ENV !== 'production'`), no longer sends `accuracy`, and carries the report type as a message prefix (`[FLOODED AREA]` / `[URGENT RESPONSE]`).
- `SubmissionSuccess.tsx`: shows the **tracking code** (copy button, "keep it private" note), status "Received", and a "View report status" link; the sequential report id is no longer shown.
- **Status pages (D22):** `/status` (`app/status/page.tsx`) lets a citizen type a code and lists "Reports from this device" (`lib/myReports.ts`, localStorage, removable); `/status/[code]` (`app/status/[code]/page.tsx` -> `components/status/ReportStatusView.tsx`) shows code, type, submitted time, current status with plain-language text, a 4-step progress list (`StatusStepper`), "last updated", and a safety note. It polls `GET /api/reports/status/<code>/` every **3 s** (no requests while the tab is hidden; as soon as the status is `resolved` it redirects with `router.replace` to the resolved notice; refreshes at once when the tab is shown again or the connection returns; retries with growing delays up to 30 s and keeps the last status with a "Reconnecting" banner if the network drops). **Resolved notice (D25):** `/status/[code]/resolved` (`components/status/ReportResolvedView.tsx`, wording in `lib/reportStatus.ts` `RESOLVED_NOTICE`, emblem in `components/ui/Emblem.tsx`) shows the "Report Resolved" notice, polls every 10 s, and redirects back to `/status/[code]` if the report is no longer resolved; opening `/status/[code]` for an already-resolved report goes straight to it. Print styles hide the buttons. There is no refresh button: a green "Live" indicator and "Status just updated" highlight show it is working. `status/layout.tsx` sets `noindex` and `referrer: no-referrer`. The map header has a "My reports" link. Wording lives in `lib/reportStatus.ts`; dates and times are formatted only by `lib/datetime.ts` (12-hour, D26).
- Update mechanism: plain REST, one-shot POST. No polling in `frontend/`. Staff pages in the Django admin poll for new reports (see "Live updates" above).

## Environment variable names (values not recorded)
- `backend/.env`: `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS` (comma-separated; now honored), `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`. Settings also read `CORS_ALLOWED_ORIGINS` (comma-separated extras added to the built-in allowlist: localhost/127.0.0.1 on :3000 and :5173, `capacitor://localhost`, `http://localhost`, `https://localhost`), `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`, `RENDER`, `DATABASE_URL`, `DJANGO_SUPERUSER_*` (build script). **No `CLOUDINARY_*` keys in the local `.env`.** For phone-on-LAN testing add the LAN host to `ALLOWED_HOSTS` and `http://<lan-ip>:3000` to `CORS_ALLOWED_ORIGINS`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL` (read by `src/lib/api.ts`; value includes the `/api` prefix), `NEXT_PUBLIC_MAP_TILE_URL` (read by `MapComponent.tsx`), `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_ENV` (the last two are unused).
- Both env files are gitignored. There is no `.env.example` (READMEs say to copy one).

## Dependencies
- Backend (`backend/requirements.txt`): Django 5.2.8, djangorestframework 3.16.1, django-cors-headers 4.9.0, cloudinary 1.44.1, dj-database-url 3.0.1, gunicorn 23.0.0, pillow 12.0.0, psycopg2-binary 2.9.11, python-dotenv 1.2.1, whitenoise 6.11.0 (+ asgiref, certifi, packaging, six, sqlparse, urllib3).
- Frontend (`frontend/package.json`): next 16.3.4, react/react-dom 19.2.8, leaflet ^1.9.4, react-leaflet ^5.0.0, lucide-react ^1.43.0; dev: tailwindcss ^4, @tailwindcss/postcss, typescript ^5, eslint ^9, eslint-config-next 16.3.4.
- `frontend/AGENTS.md` warns this Next.js version has breaking changes; read `frontend/node_modules/next/dist/docs/` before writing Next-specific code.

## Run (derived from config; only the checks in "Checks performed" were executed)
- Backend: create/activate venv, `pip install -r requirements.txt`, set `backend/.env` (PostgreSQL required; there is **no SQLite fallback**), `python manage.py migrate`, `python manage.py runserver` (127.0.0.1:8000).
- Frontend: `cd frontend && npm install && npm run dev` (http://localhost:3000). Scripts: `dev`, `build`, `start`, `lint`.
- Production: Render via `backend/build.sh` (pip install, collectstatic, migrate, superuser from env).

## Checks performed during the audit (2026-10-25)
| Check | Result |
|---|---|
| `npx tsc --noEmit --incremental false` (frontend) | exit 0 |
| `npx eslint src` (frontend) | exit 0, no output |
| `manage.py check` | no issues |
| `manage.py check --deploy` | 6 warnings (W004, W008, W009, W012, W016, W018); local env, see IMPLEMENTATION_STATUS |
| `manage.py makemigrations --check --dry-run` | no changes detected |
| `manage.py showmigrations reports` | 0001–0004 applied on the configured local DB |

### After the first fix pass (same day)
| Check | Result |
|---|---|
| `manage.py test reports` | 124 tests, OK (22 API + 42 admin + 33 tracking/status/resolved-time + 5 time-format + 16 store-and-forward + 6 routing, incl. two migration tests on pre-existing reports) (creates and destroys a `test_*` Postgres database; Cloudinary uploads mocked) |
| `manage.py check`, `makemigrations --check --dry-run` | clean, no model changes (no new migration) |
| `npx tsc --noEmit`, `npx eslint src` | exit 0 |
| `npx next build` | compiled and generated static pages; `.pb-safe` rule present in built CSS |
| Live `runserver` smoke test (read-only requests) | anonymous `all/`, `active/`, status PATCH → 401; `/health/` → 200; CORS header returned for `http://localhost:3000`, none for an unknown origin |

**Still not run**: `next dev` in a browser, a real submission to Cloudinary, any phone test, a full citizen flow end to end.

## Known startup/config issues
1. No local Cloudinary keys → real uploads likely fail locally (**Unverified**; tests mock the upload).
2. `STATICFILES_STORAGE` (`settings.py`) was removed in Django 5.1+; likely ignored (**Unverified**).
3. `next/font/google` (Inter) needs network access at build time.
4. Windows: `build.sh` is bash-only; local dev needs PostgreSQL; GDAL/GEOS paths are POSIX-gated and unused (GeoDjango not installed).
5. The legacy app is retired from routing (D28). If the backend is deployed from this branch, `/` no longer serves the old citizen app, so the Next.js frontend must be deployed for citizens.
6. Production environment variables (`ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` for the deployed Next.js site, `NEXT_PUBLIC_API_URL`) must be set; a production frontend build without `NEXT_PUBLIC_API_URL` shows a configuration error instead of submitting.

## Open questions
- Who may read reports (staff only?) and may the legacy dashboard break when endpoints are locked?
- Photo policy: backend currently demands 2; intended is "up to two".
- Role model for Responder vs LGU admin (Groups vs profile model)?
- Retire `serve_react` / committed legacy build? Keep `frontend_legacy/`?
- Nominatim usage: direct browser calls vs a proxy (usage policy).
