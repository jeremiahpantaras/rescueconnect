# RescueConnect — Architecture

Last verified: 2026-10-25 (`development` @ `c9ce45b` plus uncommitted fixes). "Confirmed" = read in source. "Intended" = owner's target, not implemented.

## Confirmed: current architecture
```
Browser (Next.js client, frontend/)
   ├─ OSM tiles  (tile.openstreetmap.org, hardcoded MapComponent.tsx:60)
   ├─ Leaflet marker icons (unpkg CDN)
   ├─ Nominatim search (direct fetch, SearchLocation.tsx:29)
   └─ POST multipart ──► Django REST (backend/, /api/reports/send/)
                           ├─ validates (views.py:26-69 + serializer)
                           ├─ PostgreSQL (EmergencyReport)
                           └─ Cloudinary (photo1, photo2)
Legacy: frontend_legacy build ──► backend/staticfiles ──► Django serve_react catch-all
```
- Frontend and backend are separate processes. Next.js has a single client-rendered page; there is no Next.js API route, server action, or middleware. All backend calls go through `frontend/src/lib/api.ts` (`submitReport`).
- Update mechanism: ordinary REST requests. No WebSockets or SSE. **Staff live updates (D21):** every open Django-admin page for a user with report access polls `GET /admin/live-reports/?after=<last id>` (session-authenticated, staff only; `tabangnegrosproj/admin_site.py` -> `reports/dashboard.live_snapshot`) every `RESCUECONNECT_LIVE_POLL_SECONDS` (default 8 s; paused in hidden tabs; backs off on errors). The response carries new reports (newest 20, plus the true count), the newest id, and dashboard counts. `static/rescueconnect/live.js` renders toasts, a header bell badge, an optional alert sound, live dashboard numbers and rows, and a "Refresh list" bar on the report list. `frontend/` (citizen app) has no polling. (Legacy admin polled every 10 s.)

## Backend
- Django 5.2.8, DRF 3.16.1, apps: `rest_framework`, `rest_framework.authtoken`, `corsheaders`, `tabangnegrosproj`, `reports`.
- Middleware includes CORS, Security, WhiteNoise, Session, CSRF, Auth.
- DB: PostgreSQL in both branches of `settings.py:87-104` (Render: `DATABASE_URL` via dj-database-url; otherwise `DB_*` env vars). Migrations 0001–0004 consistent with the model.
- Media: Cloudinary `CloudinaryField` (`models.py:27-28`); `cloudinary.config` from env (`settings.py:138`). `MEDIA_ROOT` and `/media/` route remain but are unused by the model.
- Upload limits: `DATA_UPLOAD_MAX_MEMORY_SIZE` 10 MB, `FILE_UPLOAD_MAX_MEMORY_SIZE` 5 MB, per-file 5 MB check in view, PIL format check (JPEG/PNG).
- Throttle: `EmergencyReportThrottle` (anon, `10/hour`) on create only.

## Authentication and authorization (confirmed, updated after the first fix pass)
- `settings.py` `REST_FRAMEWORK`: `TokenAuthentication` plus default permission `IsAdminUser` (deny by default: anonymous → 401, non-staff → 403).
- Public by explicit opt-out in `reports/views.py`: `EmergencyReportCreateView` (`AllowAny`, `authentication_classes = []`, so a stale token cannot block a citizen) and `admin_login` (`AllowAny`, throttled 10/min). `admin_logout` requires a valid token.
- `admin_login` issues a token only to `is_staff` users. That token now gates every read/update endpoint.
- No roles beyond `is_staff`. No Responder/LGU-admin concept, groups, or permissions in code.
- Frontend: no login UI, no route protection in `frontend/`. Legacy `ProtectedRoute.jsx` only checks `localStorage.admin_token`, and the legacy dashboard calls the API without sending the token, so it is now rejected (401).
- **Staff roles (Django admin only):** Groups `Responder` and `LGU Administrator` (`reports/roles.py`). LGU administrators manage Responder accounts; superusers manage everyone. The REST API is **not** role-aware yet: any `is_staff` user (including Responders) passes `IsAdminUser`, so a Responder token can still call `update/<pk>/`, which writes every field.
- CORS: explicit allowlist only (`settings.py`), extendable with `CORS_ALLOWED_ORIGINS`.

## Citizen status page (D22)
```
Citizen submits  ->  POST /api/reports/send/  ->  report saved as `pending` (staff queue), tracking_code created
                 <-  { id, tracking_code, ... }   (code remembered in localStorage on that device)
Citizen opens /status/<code>  ->  GET /api/reports/status/<code>/  (public; code is the credential)
Staff change the status (admin or staff API)  ->  the page's next poll (<= 3 s) shows it
Status becomes `resolved`  ->  the page redirects to /status/<code>/resolved (formal notice, shows resolved_at)
Staff reopen it            ->  the notice's next poll (<= 10 s) redirects back to /status/<code>
```
- No account, no WebSockets. The endpoint is deliberately narrow (type, status, timestamps) so a leaked code reveals little. Unknown and malformed codes both return 404. 60 bits of randomness plus a 300/min per-IP limit (generous on purpose: the page polls every 3 s and phones often share one IP) make guessing impractical.
- Throttles are separated by scope (`report_submit`, `staff_login`, `report_status`); sharing a scope shares a counter (D23).
- Staff find a report from a code a citizen reads out via the Django admin search box (any formatting).
- "Reports go to admin by default" means: new reports are `pending` and appear in the staff queue and live notifications. There is no assignment model yet.

## Offline reporting (D27)
```
Citizen taps Submit
  1. write the report (text, location, photos, a new client_ref UUID, device time) to IndexedDB  -- cannot be lost
  2. try to send it:  POST /api/reports/send/  (client_ref + reported_at included; timeout 30 s)
       success            -> delete from IndexedDB, show "Report Submitted" + tracking code
       no signal / slow / server down / 429 / 5xx -> keep it, show "Report saved on your phone. NOT yet sent"
       refused (400 etc.)  -> delete it, show the error in the form
Whenever RescueConnect is open: send saved reports on load, when the connection returns, when the tab is shown,
  and on a retry timer (15 s, 30 s, then every 60 s; each attempt may take longer on a slow link: 30 s -> 4 min).
  When one report gets through, the rest are sent immediately.  A Web Lock stops several tabs sending together.
Server: same client_ref again -> returns the ORIGINAL report (200), never a duplicate; another device -> 409.
```
- **App shell offline:** `public/sw.js` (registered in production builds only) saves the pages and files the app needs: pages network-first with a 3 s fallback to the saved copy, `/_next/static` files cache-first, map pin images served locally from `/leaflet/`. Cross-origin calls (the API, map tiles, address search) are never touched. A page that was never opened shows `public/offline.html`. `manifest.ts` + icons let it be added to the home screen. `/sw.js` is served with `no-cache` (`next.config.ts`).
- **What still needs internet:** the map background (tiles), address search, the server itself. GPS and the draggable pin work without it.
- **Staff side:** a late report is flagged in the live notification (`reported_at` vs received time) and shown in the Django admin ("Reported at").
- **Limits:** saved reports are sent only while RescueConnect is open (no background sending yet); the saved report is not visible to responders until delivered; browsers can evict storage (the app asks for persistent storage).

## Data model (confirmed)
Single table `reports_emergencyreport` (see `CURRENT_STATE.md`). No relations, no assignment/team/resource/announcement/severity/report-type fields. Status choices are a CharField with no transition logic. Deletion behavior: not applicable (no FKs).

## Workflows: intended vs implemented
| Flow | Intended | Actual |
|---|---|---|
| Citizen | No login; choose type; locate (GPS/search/pin); description + ≤2 images; submit; staff review | **Implemented** in `frontend/` (0–2 photos, API URL from env); report type is still a message prefix; not yet exercised end to end in a browser |
| Responder | Authenticated; view permitted incidents; act per role; record progress | **Not found** in `frontend/`; backend offers staff-only status PATCH |
| LGU admin | Auth, RBAC, prioritization, assignments, resources, GIS, reporting, announcements | **Not found**; legacy `AdminDashboard.jsx` lists active reports and changes status but cannot authenticate against the locked-down API |
| GIS | Leaflet + OSM; incident coordinates; zones/routes/safe areas as capabilities to verify | Map + draggable pin + Nominatim search only. No layers, zones, routes, safe areas, incident markers for staff |

## External dependencies
OpenStreetMap tiles, Nominatim (usage-policy risk: browser-direct, no identifying header control), unpkg (marker icons), Google Fonts (build-time), Cloudinary (media), Render (hosting, optional), PostgreSQL.

## Proposed context flow diagram (owner-provided 2026-10-25; **not implemented**)
Level-0 diagram with one process, "RescueConnect System — Flood Emergency Response Coordination", and three external entities. This is the owner's proposed target, so treat it as intent, not as built behavior.

| Flow | Direction | Data (as drawn) | Status in code |
|---|---|---|---|
| Incident reports | Citizen → System | Photos, ~~videos~~ (declined for now, D14), static GPS, **severity** | Photos + static GPS implemented; severity not found (owner decided staff set severity, not the citizen: D17) |
| Push notifications | System → Citizen | notifications | Not found (citizens have no accounts, so a web-push/subscription design is needed) |
| Availability status | Responder → System | availability | Not found |
| Broadcasted announcements | System → Responder | announcements | Not found |
| Response time analytics | System → LGU Administrator | analytics | Not found (no assignment/response timestamps are recorded yet) |
| User role configurations | LGU Administrator → System | roles | Not found (only `is_staff`) |

Delivery order stated by the owner: **web application first**; the longer-term scope is a mobile app. How the mobile app is built (PWA, Capacitor wrap, or native) is undecided.

Points the diagram raises that need owner confirmation before implementation (see `DECISIONS.md` P11–P14):
- Videos: **declined for now** (owner, 2026-10-25).
- Push notifications are **in scope** (owner, 2026-10-25) but need a design: Web Push needs HTTPS, a service worker, VAPID keys, and a subscription stored per report; iOS only supports it when the site is installed to the home screen.
- Severity needs approved values and a model field.
- The diagram shows no flow for incident review, status updates, assignments or resources, so those remain governed by the earlier role descriptions.

## Intended-vs-actual conflicts to resolve (not silently changed)
1. ~~Photos "up to two" vs backend "exactly two"~~ — resolved: backend and forms now accept 0–2.
2. Report type needed vs absent field (prefix workaround still in place).
3. ~~Role-based access intended vs everything public~~ — partly resolved: staff-only reads/updates now enforced; responder vs LGU-admin roles still absent.
4. Next.js frontend vs Django still serving a committed Vite build via catch-all (unchanged).
5. READMEs describe SQLite/Vite/TabangNegros; code is PostgreSQL-only/Next.js/RescueConnect (unchanged).
6. ~~Success copy says responders are notified~~ — resolved: copy corrected.
7. Context diagram shows severity, videos, push notifications, availability, announcements, analytics, and role configuration; none exist.
