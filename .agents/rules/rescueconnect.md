---
description: "Core architectural, technical, and workflow rules for the RescueConnect Frontend Migration Project."
---

# RescueConnect Project Rules

Welcome to the RescueConnect project. This project is a migration of the existing TabangNegros flood emergency response coordination system.

**CRITICAL DIRECTIVE TO ALL AGENTS:** 
**Inspect before modifying.** 
Do NOT assume. Do NOT hallucinate. Do NOT invent files, APIs, endpoints, database models, response structures, authentication mechanisms, or existing functionality. The existing codebase is the source of truth. If something is unknown, inspect the repository and search the relevant files.

## 1. Project Scope & Architecture
- **Purpose:** A flood emergency response coordination system.
- **Frontend Architecture:** Next.js, App Router, TypeScript, Tailwind CSS, Leaflet/React-Leaflet, Axios (or equivalent API client).
- **Backend Architecture:** Python, Django, Django REST Framework, PostgreSQL.
- **Migration Context:** We are migrating an existing React/Vite SPA to Next.js. Do not preserve legacy Vite architecture, but reuse proven logic where appropriate.

## 2. Approved Technologies & Dependencies
- **Strict Dependencies:** Stick strictly to Next.js, React, Tailwind CSS, and Leaflet.
- **No Unnecessary Dependencies:** Do not introduce component libraries, state management libraries (like Redux), or utility libraries unless absolutely necessary and justified.
- **TypeScript Requirements:** All frontend code must be written in TypeScript with proper strict typing. Avoid `any`.

## 3. User Roles
- **Citizen:** Can trigger SOS, report flood incidents, upload media, and share static GPS location.
- **Responder:** Has authenticated access, profile, availability status, and task assignments.
- **LGU Administrator:** Has authenticated access, role-based access control, incident prioritization, and resource management.

## 4. Specific Business Logic Rules
- **Citizen No-Login Rule:** Citizens DO NOT create accounts, log in, or register. They access the emergency interface directly.
- **No Real-Time Tracking Rule:** This is NOT live location tracking. Do not implement WebSocket-based real-time synchronization, live responder tracking, or live GPS updates. Use static incident coordinates captured at report time.
- **Out of Scope:** Do not add AI/ML, flood prediction, chat, messaging, IoT, drones, blockchain, or offline synchronization unless explicitly approved.

## 5. API-First Development & Backend Integrity
- **No Hallucinated Endpoints:** Create a clean frontend API architecture based ONLY on actual backend endpoints.
- **No Invented Models:** Do not invent backend models, response properties, or capabilities. Map every screen to actual API functionality.
- **Fallback Behavior:** If an endpoint is missing from the backend, STOP. Report that the frontend requirement exists but no backend endpoint was found. Wait for instructions.

## 6. Frontend Organization & Best Practices
- **Component Organization:** Create reusable primitives (Button, Input, Card, Modal, etc.) before building large feature pages. Keep components focused.
- **Responsive/Mobile-First Requirements:** The Citizen experience must be mobile-first. Responder interfaces should be responsive. LGU Admin dashboards should be desktop-first.
- **Accessibility Expectations:** Use semantic HTML. Ensure controls are accessible, emergency actions are large, and status indicators are clear.

## 7. Security Requirements
- **Secrets Management:** Never expose Django `SECRET_KEY`, database credentials, or backend private secrets to the frontend.
- **Environment Variables:** Always use `.env.local` for local environment variables and ensure `NEXT_PUBLIC_` is correctly applied only to safe client variables.

## 8. Git Safety Rules
- **No Destructive Actions:** Do not force push, reset destructively, or delete branches.
- **Verify Before Commit:** Inspect `git status` and `git diff` before making major changes. Do not hide unrelated user changes.
- **No Secrets in Source Control:** Never commit `.env`, `.env.local`, credentials, or secrets.
