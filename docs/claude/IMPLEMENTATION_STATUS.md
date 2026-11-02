# RescueConnect — Implementation Status

Last updated: 2026-10-25 (after the first fix pass; branch `development`, changes uncommitted).

Evidence levels used below:
- **Tested**: covered by `backend/reports/tests.py` (22 tests, all passing) and/or checked against a live local server.
- **Static-checked**: frontend change verified only by `tsc`, `eslint`, and `next build`. **Not run in a browser or on a phone.**
- **Unverified**: no run of any kind.

Status legend: Implemented and evidenced · Partially implemented · Planned but not implemented · Broken or misconfigured · Not found · Unable to verify. Confidence: H/M/L.

## Feature matrix
| Feature | Intended | Status | Evidence | Gap / defect | Next action | Conf |
|---|---|---|---|---|---|---|
| Citizen no-login access | No account needed | Implemented and evidenced | `frontend/src/app/page.tsx`; `send/` is `AllowAny` with no authentication (`views.py`, tested) | none | none | H |
| Report-type selection | Flooded Area vs Urgent Response | Partially implemented | `MapDashboard.tsx`; `ReportType` in `frontend/src/lib/api.ts` | No `report_type` field; type is a message prefix | Schema change (needs approval, see TASK_PLAN) | H |
| Device geolocation | Use GPS | Implemented and evidenced | `MapDashboard.tsx:33-56`, `OnboardingFlow.tsx:14` | Accuracy is no longer faked (field stays null); real GPS accuracy is not captured | Optional | H |
| Location search | Search address | Partially implemented | `SearchLocation.tsx` (error + empty states, Static-checked) | Browser-direct Nominatim (usage-policy review pending) | Policy decision | M |
| Adjustable pin / map | Drag pin, show coords | Implemented and evidenced | `MapComponent.tsx`; tile URL now from `NEXT_PUBLIC_MAP_TILE_URL` (Static-checked) | none known | none | H |
| Image upload (up to 2) | 0–2 images | Implemented and evidenced | `views.py` `validate_photo`; tests for 0/1/2 photos, non-image, GIF, oversize (Tested, Cloudinary mocked); `ImageUploader.tsx` (Static-checked) | Real Cloudinary upload not exercised | Run with real keys | H |
| Client image validation | Type/size | Implemented and evidenced | `ImageUploader.tsx`: inline errors, object URLs revoked (Static-checked) | `capture="environment"` may force the camera on some phones (Unverified) | Test on devices | M |
| Submission API call | Post to Django | Implemented and evidenced | `frontend/src/lib/api.ts` (`NEXT_PUBLIC_API_URL`, dev fallback only outside production, robust error parsing); both forms use it (Static-checked) | Not run end to end | Manual E2E run | M |
| Backend validation | Validate coords/images/data | Implemented and evidenced | `serializers.py` + `views.py`; status forced to `pending` on create; tests cover coordinates, short message, bad images | Message may be blank (only length-checked when provided) | Decide policy | H |
| Storage (Cloudinary) | Store photos | Unable to verify | `models.py`, `settings.py` | Local `.env` has no `CLOUDINARY_*`; tests mock the upload | Real upload test | M |
| Submission confirmation | Tracking code after submitting | Implemented and evidenced | `SubmissionSuccess.tsx` shows the code + copy + link; no longer claims responders were notified | none | none | H |
| Citizen tracking code | Random, unguessable code per report | Implemented and evidenced | `reports/tracking.py`, `EmergencyReport.tracking_code`, migrations 0005–0007 (existing rows backfilled; tested) | Collisions are only prevented by the unique constraint (probability negligible) | none | H |
| Citizen status page | Citizen sees the report's status; updates reflect | Implemented and evidenced | `GET /api/reports/status/<code>/` (25 backend tests), `/status` and `/status/[code]`; Firefox E2E: submit via UI -> code -> status page -> staff changes status -> page updated itself 3/3 times within ~3 s (about one request every 3 s per open page); screenshots reviewed | Polling, not push; ~3 s latency; no refresh button by design; not tried on a real phone; code in the URL can be seen by anyone with the phone/browser history | Device trial | M |
| Resolved notice (citizen) | Formal "Report Resolved" close-out with professional wording | Implemented and evidenced | `/status/[code]/resolved`; `EmergencyReport.resolved_at` (8 backend tests incl. every save path and a backfill migration test); Firefox E2E (28 checks): live redirect in ~3 s, notice content, direct visit redirect, reopen -> back to live page (~10 s), resolve again | Resolution time of reports resolved before migration 0008 is their last-updated time (best available); wording should be reviewed by the LGU before real use; not tried on a real phone or printer | LGU review of the wording | M |
| 12-hour clock everywhere | All displayed times use 12-hour AM/PM (D26) | Implemented and evidenced | Django format module + `g:i A` fixes (5 tests, mutation-checked); `lib/datetime.ts` checked under 11 locales; ESLint guard; Firefox in a 24-hour locale showed "10:29 pm" on the status page and notice | Machine-readable API timestamps stay ISO 8601 by design; the staff Django admin date picker widgets for filters use Django's built-in date-only widgets | none | H |
| Offline reporting (store-and-forward) | Report with no signal; saved on the phone; sent automatically later; no duplicates; staff can see it was late | Implemented and evidenced | 16 backend tests (repeat sends return the original, 409 for another device, race on the unique key, forgiving device time, late note); 6 retry-rule checks; 11 staff-notification script checks; **real-browser journey, 20 checks, with the servers stopped and started underneath it**: service worker saved the app; submit while the server was down -> "saved, not sent"; app opened with BOTH servers down; photo report saved offline; both delivered automatically 13-16 s after the server returned; saved screen flipped to "Report Submitted"; discard works; DB had exactly 3 reports, distinct refs, none duplicated | Not tried on a real phone or with real mobile-network behaviour; `navigator.onLine === false` path only reasoned/unit-tested (the browser test used "server unreachable"); sends only while the app is open (no Background Sync); map background and address search still need internet; photos are not downsized (large photos on weak links retry slowly) | Phone trial; optional: Background Sync on Android, client-side photo downsizing, cached map area | M |
| Remember reports on device | "My reports" list | Implemented and evidenced | `lib/myReports.ts`, `/status` page (E2E checked) | Lives only in localStorage (lost if cleared; shared phones can see it, Remove button provided) | none | H |
| Severity | Staff-assigned severity (D17; the diagram showed it on citizen reports) | Planned but not implemented | no field in `models.py` | Allowed values unconfirmed (P11) | Add staff-only field after P11 | H |
| Videos | Photos and videos (context diagram) | Out of scope for now | Owner decision 2026-10-25 (D14) | — | Revisit only if the owner reopens it | H |
| Status workflow | Defined transitions | Partially implemented | Status validated against choices, staff-only (Tested) | No transition rules (any status → any status) | Define transitions | H |
| Endpoint authorization | Public submit, staff-only everything else | Implemented and evidenced | `REST_FRAMEWORK` default `IsAdminUser`; anonymous → 401, non-staff → 403, staff → 200 (Tested; live server returned 401 for anonymous list/active/status) | Single role (`is_staff`) | Roles | H |
| Staff login / logout | Token login | Implemented and evidenced | `admin_login` throttled 10/min; `admin_logout` requires auth (Tested) | Token not rotated/expiring | Later | H |
| Responder access/dashboard | Auth + permitted incidents | Partially implemented | Django admin: Responder group, report list/detail, status-only edits (Tested, `tests_admin.py`; visually checked in Firefox) | No Next.js UI; REST API not role-aware | TASK_PLAN steps B–C | H |
| Responder availability status | Responder sets availability (context diagram) | Planned but not implemented | no model/endpoint | — | Needs design | H |
| Assignments / resources | Assign teams, manage resources | Not found | no models | — | Needs approval | H |
| LGU admin auth/RBAC | Roles | Partially implemented | LGU Administrator group; creates/edits/deactivates Responders in the admin; escalation guards (Tested) | REST API and Next.js not role-aware | Role-aware API | H |
| Staff account creation | Responders and LGU staff get accounts | Implemented and evidenced | `RescueConnectUserAdmin`; superuser → LGU admins, LGU admin → Responders; tampered POSTs ignored (Tested) | No self-service password reset (admin resets it); no email | Optional later | H |
| Admin UI (government style) | Professional login and dashboard | Implemented and evidenced | `templates/admin/*`, `admin.css`; rendered and screenshotted in Firefox (light/dark, desktop/phone) | Not viewed on a real phone; no WCAG audit | Review with owner | M |
| User role configuration | LGU configures roles (context diagram) | Planned but not implemented | none | — | Needs design | H |
| Admin incident UI (Next.js) | Dashboards | Not found | only in `frontend_legacy/` | Legacy dashboard now receives 401 (see C2) | Rebuild in Next.js | H |
| Broadcast announcements | System → Responders (context diagram) | Planned but not implemented | none | — | Needs design | H |
| Push notifications | System → Citizens (context diagram); staff in-app notifications are separate and done (see above) | Planned but not implemented | none; approved in scope (D15) | Citizens have no accounts; Web Push needs HTTPS, service worker, VAPID keys, stored subscriptions | Design (P13) | H |
| Response-time analytics | System → LGU (context diagram) | Planned but not implemented | none | No assignment/response timestamps recorded | Needs design | H |
| GIS layers | Zones, routes, safe areas | Not found | only tiles + marker | — | Data source decision | H |
| Update mechanism | Plain API; staff near-real-time (D21) | Implemented and evidenced | citizen app: no polling; admin: `live.js` polling `/admin/live-reports/` | Not WebSockets; ~8 s latency by design | Revisit only if too slow | H |
| Staff live updates + in-app notifications | New reports appear for Responders/LGU within seconds, with notification | Implemented and evidenced | `admin_site.live_reports`, `dashboard.live_snapshot`, `live.js`, header bell/sound, toasts, live dashboard; 13 backend tests; 10 browser-script checks in Node; real-server E2E (citizen POST visible to staff poll in ~24 ms; anonymous redirected); toasts screenshotted in Firefox | Not tried by a human on a second device; sound untested (browsers need a prior click); polling is per open tab | Owner trial with two browsers | M |
| Django admin for reports | Manage data | Implemented and evidenced | `EmergencyReportAdmin`, dashboard, tests, screenshots | Photo thumbnails untested with real Cloudinary images | Check with a real report | M |
| Tests | Coverage | Partially implemented | 22 backend tests passing; none for frontend | No frontend tests | Add later | H |
| Static checks | Lint/types/build | Implemented and evidenced | `tsc`, `eslint src`, `next build` all succeeded; `manage.py check`; `makemigrations --check` | — | none | H |
| Deployment config | Safe prod | Partially implemented | CORS allowlist + `ALLOWED_HOSTS` from env | `check --deploy` warnings remain; production env Unverified | Production settings pass | M |

## Fixed in the 2026-10-25 pass
| ID | Fix | Where | Evidence |
|---|---|---|---|
| C1 | Default-deny API (`IsAdminUser`); only `send/` and `auth/login/` are public | `settings.py` `REST_FRAMEWORK`, `reports/views.py` | Tested + live 401s |
| M1 | New reports always start `pending`; citizen-supplied status ignored | `EmergencyReportCreateView.perform_create` | Tested |
| — | Status PATCH validates against model choices; unknown report → 404 | `update_report_status` | Tested |
| M2 | `nearby` validates lat/lng/radius (400 on junk, NaN, inf, out of range) | `get_reports_by_area` | Tested |
| H1 | Photos optional, up to 2; validation per photo | `validate_photo` | Tested (Cloudinary mocked) |
| H2 | API base from `NEXT_PUBLIC_API_URL`; no hardcoded host | `frontend/src/lib/api.ts` | Static-checked |
| H6 | `CORS_ALLOW_ALL_ORIGINS` removed; allowlist + `CORS_ALLOWED_ORIGINS` env; includes `localhost:3000` and `https://localhost` (Capacitor Android) | `settings.py` | Live: allowed origin gets header, unknown origin none |
| M8 | `ALLOWED_HOSTS` read from env; `.onrender.com` wildcard fixed | `settings.py` | `manage.py check` |
| M9 | Error parsing handles `error`, `detail`, DRF field errors, 429, non-JSON, network failure | `api.ts` | Static-checked |
| M10 | Success copy no longer claims responders were notified | `SubmissionSuccess.tsx` | Static-checked |
| — | Fabricated `accuracy='10'` no longer sent | `api.ts` | Static-checked |
| — | `pb-safe` defined; `viewport-fit=cover` set | `globals.css`, `layout.tsx` | Built CSS contains the rule |
| — | Search error/empty states, aria-labels, object-URL revocation, `alert()` removed, tile URL env | `SearchLocation.tsx`, `ImageUploader.tsx`, forms, `MapComponent.tsx` | Static-checked |
| — | Login throttle (10/min) added (not in the original audit) | `views.py` | Tested |
| — | `EmergencyReport` registered in Django admin | `reports/admin.py` | `manage.py check` |
| M4 | **Withdrawn.** Cloudinary's `pre_save` already rewinds the file; an explicit `seek(0)` was added anyway | `validate_photo` | Code read |
| — | `/admin` (no slash) and browsers holding an old site-wide worker showed the old Tabang Negros app. Catch-all removed; `/sw.js` now removes the old worker | `tabangnegrosproj/urls.py`, `staticfiles/sw.js` | 6 routing tests; reproduced and healed in real Firefox with the old worker confirmed on disk beforehand. Chrome/Edge and the owner's Windows device not tested |
| — | Throttles shared one counter per IP (default `anon` scope): staff-login attempts and (new) status polling would have eaten the 10/hour report quota. Each throttle now has its own scope | `reports/views.py` | Tested; the new tests fail when the old shared scope is restored |

## Still open
### High
- **C2 — legacy admin dashboard no longer works.** `frontend_legacy/src/components/AdminDashboard.jsx` calls `/active/` and the status PATCH without a token. Django still serves its committed, compiled build from `backend/staticfiles/`, and editing the source would not change that build. Accepted consequence of the C1 fix; a Next.js staff dashboard is the replacement (not built yet).
- H3 Roles exist only in the Django admin. The REST API is not role-aware (any `is_staff` user, including a Responder, can call every staff endpoint) and there is no staff login or route protection in `frontend/`.
- H4 No `report_type` / severity field (severity is also shown in the proposed context diagram).
- H5 Cloudinary keys absent from the local `.env`; real uploads untested.

### Medium
- M3 Throttle keyed on client IP; spoofable via `X-Forwarded-For` behind a proxy unless `NUM_PROXIES` is set (**risk, needs testing**).
- M5 No frontend tests.
- M6 `build.sh` uses `migrate --run-syncdb` with a `--fake-initial` fallback that can mask failures.
- M7 `/media/` served via `django.views.static.serve` in production (`tabangnegrosproj/urls.py`).
- M11 `check --deploy` (local env): W004 HSTS, W008 SSL redirect, W009 weak SECRET_KEY, W012/W016 insecure cookies, W018 DEBUG=True. Production settings **Unable to verify**.
- Django admin login has no brute-force throttle (the API login does). Needs middleware or a package.
- Update endpoint (`update/<pk>/`) lets staff overwrite every field (coordinates, message, device_id, photos). Intended for staff only, but consider narrowing.

### Low
- Naming drift (`tabangnegrosproj`, Cloudinary folder, READMEs, `instructions.txt`).
- Offline: saved reports are sent only while RescueConnect is open; no photo downsizing; no offline map tiles; the browser cannot report that the server (not the network) is down, so "offline" means "could not reach RescueConnect".
- 7 of 10 UI primitives unused; `BottomNav` links to nonexistent `/map`, `/status`, `/profile`.
- `ErrorBoundary.tsx` renders raw error text.
- Unused `FileExtensionValidator` import (`models.py:2`); GDAL/GEOS paths unused (`settings.py`); `STATICFILES_STORAGE` is removed in Django 5.1+ and likely ignored (**Unverified**).
- `docs/frontend-codebase-analysis.md` is stale.
- Windows: no `.env.example`, bash-only `build.sh`, Postgres required locally.
- `frontend/AGENTS.md` demands reading the bundled Next.js docs before Next-specific code; the `viewport` export was checked against them.
