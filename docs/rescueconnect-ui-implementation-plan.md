# RescueConnect UI Implementation Plan

Based on the UI Workflow Analysis, the following implementation plan breaks down the development of the new "Map-First", "No Login" Citizen Experience into 11 distinct phases. 

> [!WARNING]
> **Backend Gaps Identified:** The backend currently strictly requires exactly 2 photos per report and lacks a `report_type` field to distinguish between "Flooded Area" and "Urgent Response". The frontend will implement the UI for these flows, but backend adjustments will be necessary for successful submission.

## PHASE A: Permission and Startup Experience
- **Goal:** Educate the user on required permissions (primarily Location).
- **Files Affected:** `src/app/page.tsx`, `src/components/permissions/PermissionFlow.tsx`.
- **Implementation:** Create a UI state that checks `localStorage` to see if the user has completed onboarding/permissions. If not, show a screen explaining why Location is needed, with an "Allow Location" button that triggers `navigator.geolocation.getCurrentPosition()`.
- **Dependencies:** HTML5 Geolocation API.

## PHASE B: Welcome/Onboarding
- **Goal:** Introduce RescueConnect's purpose via a slide carousel.
- **Files Affected:** `src/components/onboarding/OnboardingCarousel.tsx`.
- **Implementation:** 5-slide carousel explaining location sharing, flood reporting, and urgent responses. Saves completion state to `localStorage`.
- **Dependencies:** Standard React state (no extra libraries needed).

## PHASE C: Map-First Dashboard
- **Goal:** The primary workspace view.
- **Files Affected:** `src/components/map/MapDashboard.tsx`, `src/app/page.tsx`.
- **Implementation:** Full-screen Leaflet map component (dynamically imported with `ssr: false`). Displays the map filling the screen, with the Header floating above and primary action buttons ("Report Flooded Area", "Urgent Response") anchored below the map.

## PHASE D: Location Selection/Editing
- **Goal:** Allow the user to drag the pin to set the precise report location.
- **Files Affected:** `src/components/map/DraggableMarker.tsx`, `src/components/map/CurrentLocationButton.tsx`.
- **Implementation:** Use `react-leaflet` to make the marker `draggable={true}`. The marker coordinates update local state. The "Current Location" button uses `navigator.geolocation` to fly the map back to the user's physical location.

## PHASE E: Search Location
- **Goal:** Allow address-based location searching.
- **Files Affected:** `src/components/map/SearchLocation.tsx`.
- **Implementation:** Integrate OpenStreetMap's Nominatim API (free, no key required) to search for addresses. Selecting a result pans the map and drops the draggable marker there.

## PHASE F: Flooded Area Reporting
- **Goal:** Focused form for flood reporting.
- **Files Affected:** `src/components/reports/FloodReportForm.tsx`, `src/components/reports/ImageUploader.tsx`.
- **Implementation:** A slide-over or full-page view containing the selected location, a file input `<input type="file" accept="image/*" multiple>` (limited to 2), and a textarea for the message. Uses standard HTML5 file APIs instead of Capacitor.

## PHASE G: Urgent Response Reporting
- **Goal:** Focused form for emergencies.
- **Files Affected:** `src/components/emergency/UrgentResponseForm.tsx`.
- **Implementation:** Similar to Phase F, but visually distinct (e.g., using emergency red colors/alerts) to emphasize urgency. 

## PHASE H: Review/Submission
- **Goal:** Final confirmation before sending.
- **Files Affected:** `src/components/reports/ReportReview.tsx`.
- **Implementation:** Displays the map snapshot, selected photos, and message. Submits a `FormData` object to `POST /api/reports/send/`. 
- **Risk:** Unless `views.py` is modified, submitting < 2 photos will result in a 400 Bad Request. 

## PHASE I: Success/Error States
- **Goal:** Graceful handling of network/API responses.
- **Files Affected:** `src/components/reports/SubmissionSuccess.tsx`, `src/components/ui/ErrorState.tsx`.
- **Implementation:** On success, display the backend response (which returns the DB `id` as the reference number). On failure, show clear error messages without exposing stack traces. Retains form state so the user can retry.

## PHASE J: Responsive/Mobile Optimization
- **Goal:** Ensure perfect usability on mobile devices.
- **Files Affected:** Global CSS, all UI components.
- **Implementation:** Verify touch target sizes (min 44x44px), ensure the software keyboard doesn't obscure textareas, test safe-area paddings for iOS, and ensure the map remains usable on small screens.

## PHASE K: Testing
- **Goal:** End-to-end verification.
- **Implementation:** Manual browser testing across Chrome/Safari emulators for permissions, file uploads, and map interactions. Verify that offline IndexedDB logic is fully removed.

---

### Request for Feedback
1. **Backend Adjustments:** Do you approve modifying the backend (`views.py`, `models.py`) to make photos optional/up to 2, and to add a `report_type` field? Or should the frontend simulate this by sending empty blobs/appending the type to the message string?
2. **Geocoding:** Is OpenStreetMap Nominatim acceptable for the Search Location feature, or is there an existing key/service you prefer?
