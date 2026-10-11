# Phase 0: Frontend Codebase Analysis

## A. Current Architecture
The current project is named **TabangNegros**, operating as an emergency help request system. 
- **Backend:** Located in `backend/`, built with Django (v4.2+) and Django REST Framework. It uses PostgreSQL and is configured for deployment on Render. Static files are served via Whitenoise.
- **Frontend:** Located in `frontend/`, built as a Single Page Application (SPA) using React 19.1.1, Vite, Tailwind CSS, and React Router DOM. It heavily integrates Capacitor for cross-platform mobile support (Android/iOS).
- **Documentation:** The project includes `instructions.txt` at the root which outlines the build process for mobile apps.

## B. Existing Frontend Architecture
- **Framework:** React SPA bundled with Vite (`frontend/vite.config.js`). 
- **Mobile Integration:** Capacitor is heavily integrated (`frontend/capacitor.config.ts`, `frontend/android/`, `frontend/ios/`).
- **Dependencies (`frontend/package.json`):**
  - Uses `react`, `react-dom`, `react-router-dom`.
  - Uses `axios` for HTTP requests.
  - Uses `leaflet` and `react-leaflet` for GIS.
  - No `next` dependency is present; it has not been migrated to Next.js yet.
- **Component Structure (`frontend/src/`):**
  - Contains a flat component directory: `AdminDashboard.jsx`, `CameraCapture.jsx`, `Login.jsx`, `ProtectedRoute.jsx`.
  - Uses IndexedDB for offline storage (`frontend/src/db.js`).
- **Routing:** Handled via `react-router-dom` in `frontend/src/App.jsx`.

## C. Existing Backend API Architecture
- **Base URLs (`backend/tabangnegrosproj/urls.py`):**
  - Admin: `/admin/`
  - API: `/api/reports/`
  - Health check: `/health/`
  - React catch-all route for SPA fallback.
- **Endpoints (`backend/reports/urls.py`):**
  - `POST /api/reports/send/`: Create an emergency report (allows image uploads up to 5MB, 10/hour throttle).
  - `GET /api/reports/all/`: List all reports.
  - `PUT/PATCH /api/reports/update/<pk>/`: Update an entire report.
  - `GET /api/reports/active/`: Get active/pending reports.
  - `GET /api/reports/nearby/?lat=X&lng=Y&radius=Z`: Get reports within a geographic radius.
  - `PATCH /api/reports/<report_id>/status/`: Update the status of a specific report.
  - `POST /api/reports/auth/login/`: Admin login (checks `is_staff`, returns Token).
  - `POST /api/reports/auth/logout/`: Admin logout.
- **Models (`backend/reports/models.py`):**
  - `EmergencyReport`: Stores `latitude`, `longitude`, `accuracy`, `message`, `device_id`, `status` (pending, acknowledged, responding, resolved), `photo1`, `photo2` (Cloudinary).
- **Authentication:** Token-based authentication via `rest_framework.authtoken` (TokenAuthentication). The `admin_login` view validates against the Django standard `User` model checking `is_staff`.

## D. Reusable Code
- **Map Configuration/Components:** The usage of `react-leaflet` in `frontend/src/App.jsx` or map components can be partially reused, although they will need to be adapted to Next.js (e.g. `next/dynamic` for client-side rendering).
- **Tailwind Config:** The styling utilities and basic CSS (`frontend/index.css`, Tailwind settings) can be migrated.
- **API Utilities:** Axios configurations or data fetching hooks (`frontend/src/components/AdminDashboard.jsx`, etc.) can be reused conceptually but refactored to fit the Next.js App Router (using Server Components where appropriate).

## E. Code that must be rewritten
- **Vite & React Router:** The entire Vite setup (`vite.config.js`) and React Router (`react-router-dom` in `App.jsx`) must be replaced with Next.js App Router (`app/` directory).
- **Capacitor Mobile Shell:** Capacitor Android/iOS folders (`frontend/android`, `frontend/ios`) and configuration might need re-evaluation depending on whether the Next.js app will be wrapped in Capacitor or just run as a PWA. (The prompt specifies the frontend must use Next.js, App Router, etc.).
- **Entry Points:** `frontend/src/main.jsx` and `index.html` are specific to Vite and must be removed in favor of Next.js `layout.tsx` and `page.tsx`.

## F. Missing Backend Capabilities
The prompt requires certain features for RescueConnect that do not currently exist in the `tabangnegrosproj` backend:
- **Missing Roles:** The backend only authenticates admin users (`is_staff`). There is no specific "Responder" or "LGU Administrator" role logic or user model beyond the standard Django admin.
- **Responder APIs:** Missing endpoints for assigning responders, dispatching tasks, tracking responder availability, and marking rescue tasks completed.
- **Missing Models:** No models for `Rescue Teams`, `Resources` (Rescue boats, Medical supplies, Evacuation centers).
- **Missing Emergency Report Fields:** The `EmergencyReport` model lacks `severity` (Low, Moderate, High, Critical) and `incident_type` fields.
- **Analytics:** No endpoints exist for Incident statistics, response time analysis, rescue success rate, or resource utilization reports.
- **Notifications:** No push notification or emergency announcement models/endpoints exist.
- **GIS Features:** Missing data endpoints for "Evacuation centers," "Safe areas," "Evacuation routes," and "Flood-prone zones."

## G. Potential Conflicts
- **Environment Variables:** The backend `.env` file (`backend/.env`) handles secrets. Next.js will need `.env.local` with `NEXT_PUBLIC_` prefixes. Care must be taken not to leak backend secrets.
- **Routing:** The backend `tabangnegrosproj/urls.py` has a catch-all route `re_path(r'^.*$', serve_react, name='react-app')` that serves the Vite React app. Next.js will run its own server, so this Django catch-all route will conflict if both are served on the same domain or if Next.js handles all frontend routing.
- **CORS:** `CORS_ALLOWED_ORIGINS` in `settings.py` allows `http://localhost:5173` (Vite). Next.js defaults to `http://localhost:3000`, so CORS settings will need updating.

## H. Migration Risks
- **Data Loss/Inconsistency:** Deleting the Vite frontend too early could break mobile builds if the team still relies on the Capacitor setup.
- **Next.js & Leaflet:** `react-leaflet` requires the `window` object and must be dynamically imported with `ssr: false` in Next.js to avoid server-side rendering crashes.
- **IndexedDB / Offline functionality:** `frontend/src/db.js` uses IndexedDB. If the Next.js app is deployed server-side, offline functionality will need to be carefully re-implemented for PWAs or Capacitor.

## I. Recommended Implementation Order
1. **Phase 1 (Rules):** Establish Antigravity Rules in `.agents/rules/`.
2. **Phase 2 (Foundation):** Clean up the `frontend` directory. Remove Vite dependencies, init Next.js (`npx create-next-app`), configure Tailwind CSS and TypeScript.
3. **Phase 3 (Design System):** Rebuild the primitive components (Buttons, Inputs, Cards) in Next.js.
4. **Phase 4 (API Layer):** Implement the `lib/api` layer based *only* on the existing backend endpoints (e.g., `/api/reports/send/`).
5. **Phase 5 (Citizen Experience):** Build the Home and SOS flow (no login required).
6. **Backend Sync:** Request or document the backend changes needed for Phase 6+ (Responders, LGU Admins, Analytics).
7. **Subsequent Phases:** Build Responder and LGU Admin interfaces once backend supports them, or mock the UI and mark clearly.

## J. Files that should be created
- `docs/frontend-codebase-analysis.md` (this file).
- `.agents/rules/rescueconnect-rules.md` (for Phase 1).
- Next.js configuration files (`next.config.ts`, `tsconfig.json`).
- `frontend/app/layout.tsx`, `frontend/app/page.tsx`.
- `frontend/.env.local`.

## K. Files that should NOT be modified
- `backend/*` (Do not modify backend models/views until specifically requested, to respect the strict "do not invent" rule).
- `instructions.txt` (Contains historical deployment instructions).
- `frontend/android/` and `frontend/ios/` (Leave intact until the mobile strategy for Next.js is confirmed).

## L. Questions requiring clarification
- **Backend Updates:** Who will implement the missing backend features (Responder roles, Analytics, Resource management, Severity fields)? Should the frontend provide mock UI components in the meantime, or wait?
- **Mobile Build Strategy:** The existing project uses Capacitor for Android/iOS builds. Will the new Next.js app also be wrapped in Capacitor, or will it be purely a web/PWA application?
- **Django Routing:** Since Next.js has its own server, should we remove the `serve_react` catch-all route in `tabangnegrosproj/urls.py`?
