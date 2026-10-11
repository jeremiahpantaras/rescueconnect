# RescueConnect UI Workflow Analysis

## 1. Current Frontend Architecture
- **Legacy Framework:** Vite + React + Capacitor (in `frontend_legacy/`).
- **New Framework:** Next.js 16 (App Router) + Tailwind CSS v4 (in `frontend/`).
- **State Management:** React `useState`/`useEffect` (no global state library used in legacy `App.jsx`).

## 2. Current Citizen Workflow
The citizen experience in `frontend_legacy/src/App.jsx` is a single, scrollable form:
1. **Preloader:** Shows a 5-second animated preloader.
2. **Location Request:** Immediately tries to fetch location on mount via Capacitor/HTML5. If denied, it displays a blocking "Enable Location Access" card.
3. **Map Display:** Once location is acquired, displays a small, static map showing the user's location. The pin is **not draggable**.
4. **Camera:** Prompts the user to take exactly 2 photos using `@capacitor/camera` (no gallery fallback).
5. **Form:** A single textarea for "What help do you need?".
6. **Submission:** Sends `FormData` to the backend. Offline mode saves to IndexedDB. There is no separate onboarding flow or dedicated map dashboard.
7. **No Citizen Login:** The legacy app correctly relies on a generated `device_id` (stored in `localStorage`) rather than citizen accounts. There is an Admin login route (`/login`).

## 3. Existing Map & Location Implementation
- **Map:** Uses `react-leaflet` (`MapContainer`, `TileLayer`, `Marker`, `Popup`).
- **Location:** Primarily uses Capacitor (`Geolocation.checkPermissions()`), falling back to `navigator.geolocation` if Capacitor fails. Reverse geocoding is implemented via a utility function (`getAddressFromCoords`).
- **Issue:** The location pin is currently static. To support the new workflow, the pin must become draggable (or the map movable underneath a fixed pin).

## 4. Existing Permission Handling
- Heavily relies on native Capacitor APIs (`Camera.checkPermissions()`, `Geolocation.checkPermissions()`).
- **Next.js Limitation:** Capacitor APIs cannot be used directly in the standard web/PWA browser environment. We must replace these with standard HTML5 Permissions API (`navigator.permissions.query`), `navigator.geolocation`, and file inputs (`<input type="file" accept="image/*" capture="environment">`).

## 5. Existing Media Upload Implementation
- `frontend_legacy/src/components/CameraCapture.jsx` forces the use of the device camera (`CameraSource.Camera`) and prevents gallery uploads. 
- It validates that files are under 5MB and outputs Base64.
- `App.jsx` manually converts Base64 to Blobs before submitting via `FormData`.

## 6. Existing API Integration
- **Endpoint:** `POST /api/reports/send/` (mapped from Django's `views.py:EmergencyReportCreateView`).
- **Payload:** `multipart/form-data` containing `latitude`, `longitude`, `accuracy`, `message`, `device_id`, `photo1`, `photo2`.

## 7. Backend Gaps & Conflicts
Based on inspecting `backend/reports/views.py` and `backend/reports/models.py`:
1. **Photo Requirement:** The user requested "Up to 2 images", but `views.py` explicitly rejects requests missing photos (`if not photo1 or not photo2: return Response({'error': 'Both photo1 and photo2 are required'})`).
2. **Report Types:** The new workflow introduces two distinct actions: "Report Flooded Area" and "Urgent Response". The `EmergencyReport` model does not have a `report_type` or `category` field; everything is lumped into one model.
3. **Reference Number:** The model does not generate a specific reference number (only the primary key `id` is created).
4. **Conclusion:** Backend modifications will be required to make photos optional (or allow 0-2 photos) and to add a `report_type` field.

## 8. Component Reusability & Redesign
- **Can be reused/adapted:** Leaflet map component logic (needs `ssr: false` in Next.js), UI primitives created in Phase 3 (`Button`, `Card`, `Indicators`).
- **Needs redesign:** The entire `App.jsx` needs to be split into the requested phases (Permissions, Onboarding, Map Dashboard, Report Forms).
- **Should be removed:** Capacitor dependencies (`@capacitor/camera`, `@capacitor/geolocation`), Offline IndexedDB sync (explicitly forbidden in the prompt).

## 9. Recommendations & Risks
- **Geocoding:** We need to implement a Search Location feature. Since none exists in the backend natively, we will need to integrate a third-party geocoding service like Nominatim (OpenStreetMap) or Mapbox to avoid backend changes.
- **Risk:** Implementing native-like permissions in a PWA can be tricky since iOS Safari does not support proactive permission querying for cameras. We will need to trigger permissions on user interaction (e.g., clicking "Allow Location" triggers `navigator.geolocation.getCurrentPosition`).
