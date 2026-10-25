# RescueConnect — Task Plan

Last updated: 2026-10-25. Steps marked "needs approval" depend on the proposals in `DECISIONS.md`. Mark steps complete only after the stated verification has actually been run.

## Status of the original roadmap
| Step | State |
|---|---|
| 1. Secure the report API + backend tests | **Done and tested** (22 tests passing, live 401 check). Legacy admin dashboard intentionally broken (C2). |
| 2. Citizen submission contract | **Partly done.** Done: photos 0–2, API URL from env, robust errors, honest success copy, no fake accuracy. **Open:** `report_type` field (P16), severity (P11), videos (P12). Frontend changes are Static-checked only. |
| 3. Config hygiene | **Partly done.** Done: CORS allowlist, `ALLOWED_HOSTS` from env, Django admin registration. **Open:** `.env.example` files, `build.sh` migration fallback (M6), `/media/` route (M7), README corrections, production settings pass. |
| 4. Roles and auth | **Partly done.** Done: Responder/LGU Administrator groups and account creation in the Django admin. **Open:** role-aware REST API permissions, Next.js staff login, route protection |
| 5. Responder / LGU dashboards in Next.js | Not started |

## Immediate verification still owed (before building more)
1. Run the citizen flow in a browser: `cd backend && virt/bin/python manage.py runserver`, `cd frontend && npm run dev`, submit a Flooded Area report and an Urgent Response report with 0, 1 and 2 photos. This needs `CLOUDINARY_*` in `backend/.env` for photos; without keys, 0-photo submissions are the only fully testable path.
2. Log in as a staff user (`POST /api/reports/auth/login/`) and confirm the token opens `all/`, `active/`, and the status PATCH.
3. Open `/admin/` and confirm `EmergencyReport` appears.
4. Phone test on LAN: add the LAN host to `ALLOWED_HOSTS` and `http://<lan-ip>:3000` to `CORS_ALLOWED_ORIGINS`; set `NEXT_PUBLIC_API_URL` to the LAN backend; confirm geolocation (needs HTTPS or localhost on most mobile browsers; **Unverified**).

5. Citizen status page: submit a report on a phone, keep the status page open, change the status in the Django admin on a computer, and confirm the phone updates within ~3 s. Also try the code from a second phone via `/status`.

6. Offline reporting: build and run the production app (`npm run build && npm run start` in `frontend/`), open it once with a connection, switch the phone to airplane mode, open the app, make a report, see "saved, NOT sent", turn the connection back on and confirm it is delivered and the tracking code appears. Also try it with the server stopped.

## Next steps, in dependency order

### Step A — Report data model aligned with the context diagram (severity is staff-set, D17; still needs approval of the severity values P11 and of the `report_type` change P16; videos declined, D14)
- Files: `backend/reports/models.py` + new migration (inspect before applying), `serializers.py`, `views.py`, `tests.py`; `frontend/src/lib/api.ts`, `FloodReportForm.tsx`, `UrgentResponseForm.tsx`, `MapDashboard.tsx`.
- Work: `report_type` choices (flooded_area / urgent_response) replacing the message prefix, with a backfill from existing prefixes; severity field with owner-approved values; decide on video support.
- Risks: data migration on production data; the legacy prefix format must still be understood during rollout.
- Acceptance: new reports store `report_type` (and severity if approved); old rows backfilled; tests cover validation and migration; forms send the new fields.
- Verify: `manage.py test`, `makemigrations --check`, migration applied on a copy of the database first.

### Step B — Role-aware API and staff login in the web app (roles themselves exist, D18)
- Roles: Responder vs LGU Administrator (proposal: Django Groups), plus the role returned by login.
- Files: `backend/reports/` (permissions module), `views.py`, new `frontend/src/app/login`, route protection, token storage decision (localStorage vs httpOnly cookie; document the trade-off).
- Acceptance: unauthorized roles get 403 with tests; Responder cannot reach LGU-only actions.

### Step C — Responder and LGU dashboards in Next.js
- Live updates (D21) currently exist only in the Django admin and use an admin-session endpoint. The Next.js dashboard needs a token-authenticated equivalent (a new `reports/` API view reusing `dashboard.live_snapshot`) with role checks.
- Incident list + Leaflet map of reports, status updates with manual refresh or polling (no WebSockets). Replaces the broken legacy dashboard.
- Depends on A and B. Assignments, resources, availability, announcements, analytics, GIS layers (diagram flows P14) only after owner approval and data-model design.

### Step D — Remaining config hygiene
- `.env.example` files (names only), README rewrite for RescueConnect/PostgreSQL/Next.js, safer `build.sh`, replace `serve` for `/media/`, `check --deploy` pass with production-like env, decide fate of `serve_react` and the committed `backend/staticfiles` build (P8).

### Step F — Offline follow-ups (optional)
- Background Sync (Android Chrome) so saved reports send even when the app is closed; client-side photo downsizing for weak links; cached map area for the LGU (needs a permitted tile source); SMS fallback for places with no data at all.

### Step E — Push notifications (scope approved, D15; design open: P13)
- Service worker + subscribe flow in `frontend/`, a subscription model/endpoint in `backend/reports/`, a sender using VAPID keys (new dependency, needs approval), and a rule for which events notify (e.g., status change). Requires HTTPS outside localhost; iOS needs the site installed to the home screen.

## Next task for Claude
Run the "Immediate verification" list above with the owner (it needs a browser and Cloudinary keys), then start Step A once P11/P12/P16 are answered.
