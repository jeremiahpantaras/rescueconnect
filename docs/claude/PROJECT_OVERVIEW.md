# RescueConnect — Project Overview

Last verified: 2026-10-25 (initial audit, branch `development` @ `c9ce45b`).

## Purpose
RescueConnect: Flood Emergency Response Coordination System. A mobile-friendly web app where citizens report flooded areas and request urgent response without an account, and where authenticated responders and LGU administrators coordinate the response.

The repo evolved from **TabangNegros** (a Vite/React/Capacitor emergency-help app). Legacy names persist in code; see "Naming drift".

## Scope
In scope (intended): citizen no-login reporting (`Report Flooded Area`, `Urgent Response`), GPS/search/draggable-pin location, up to 2 photos, responder and LGU-admin coordination, Leaflet + OpenStreetMap GIS.

**Explicitly excluded** (do not propose as ordinary work): live tracking, AI/ML, flood prediction, chat/messaging, IoT, drones, blockchain, national-system integration. Real-time WebSockets and live tracking were removed from scope. **Offline exception (D27, 2026-10-25):** citizen reports can be made with no signal, saved on the phone, and sent automatically later (store-and-forward only; staff screens stay online-only; no offline maps). **Exception (D21, 2026-10-25):** staff pages in the Django admin poll for new reports every few seconds and show in-app notifications.

## Delivery order
Web application first (Next.js in `frontend/`); a mobile app is the longer-term scope. The owner supplied a proposed context flow diagram on 2026-10-25; it is summarized in `ARCHITECTURE.md` and its new elements (severity, videos, push notifications, responder availability, announcements, analytics, role configuration) are proposals tracked in `DECISIONS.md`, not confirmed scope.

## Roles
| Role | Intended | Implemented today |
|---|---|---|
| Citizen | No account/login; report incidents with static coordinates | Yes, Next.js flow (`frontend/src/app/page.tsx`) |
| Responder | Authenticated; sees permitted incidents/assignments; updates status | **Not implemented** (no role, no UI) |
| LGU Administrator (Local Government Unit) | Authenticated; RBAC; prioritization; resources; GIS/reporting | **Not implemented**; only Django `is_staff` login (now enforced on all non-public API endpoints) + a legacy dashboard that no longer works |

## Intended stack vs verified
Intended: Next.js/React/TS/Tailwind, Django (API), PostgreSQL, Leaflet + OSM, Git/GitHub. All are present in the repo. Details and gaps are in `ARCHITECTURE.md`.

## Repository facts
- Working branch: `development` (tracks `origin/development`). Main branch for PRs: `main`. A local `production` branch tracks `upstream/production`.
- `origin`: `https://github.com/jeremiahpantaras/rescueconnect.git`
- `upstream`: `https://github.com/jeremiahpantaras/tabangnegros.git`
- No evidence in the repo of testing, adoption, or partnership with any external agency. Do not claim any.

## Terminology
- **Report**: one `EmergencyReport` row (`backend/reports/models.py`). There is no separate "incident" model.
- **Report type**: not a field. Encoded as a message prefix `[FLOODED AREA]` / `[URGENT RESPONSE]` by the frontend forms.
- **Status values** (model choices): `pending`, `acknowledged`, `responding`, `resolved`. No enforced transitions.
- **Tracking code**: random secret (XXXX-XXXX-XXXX) given to a citizen when they submit; the only credential for the public status page. Not derived from the report id. See `DECISIONS.md` D22.
- **device_id**: client-generated string in `localStorage` (`device_id`); it is not an identity or auth mechanism.

## Rules future sessions must preserve
(From `.agents/rules/rescueconnect.md` and the owner's prompts.)
1. Inspect before modifying; never invent files/endpoints/models/fields.
2. Citizens never log in or register.
3. No live tracking / WebSockets; use static coordinates captured at report time.
4. No new dependencies (component libs, state libs) unless justified; TypeScript strict, avoid `any`.
5. Never expose `SECRET_KEY`/DB creds to the frontend; `NEXT_PUBLIC_` only for safe values.
6. No destructive git; no commits/pushes unless explicitly asked; never commit `.env*`.
7. Use the RescueConnect name in new docs/UI text.
8. If a needed backend endpoint is missing, stop and report; do not mock it silently.
9. **Times are always 12-hour with AM/PM, never 24-hour** (D26). Use `src/lib/datetime.ts` in the frontend and the formats in `backend/tabangnegrosproj/formats/en/formats.py` (or `g:i A`) in Django; never `H:i`, `toLocaleTimeString`, or `Intl.DateTimeFormat` directly.

## Naming drift (known, unresolved)
`tabangnegrosproj` (Django project package), Cloudinary folder `tabang_negros/reports`, root `README.md`, `backend/README.md`, `instructions.txt` (all describe TabangNegros/Vite), Render URL `tabangnegros.onrender.com`. Renaming is **not** decided (see `DECISIONS.md`).
