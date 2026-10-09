# RCA — Static asset availability (deployment qtrack-4)

## Scope
Scoped to deployed/published static-image & media availability and routing only. Visual redesign (mobile density, "pure white/premium look", video placement, removing the 01/02 figures) is explicitly out of scope and left to normal code changes by E1/user. Backend/auth/db untouched.

## Problem statement
User reports (on mobile): "a lot of content, image doesn't load, whole website is pure white / unfinished look." Recent change added `/images/hcci-logo.png` (PNG 738x198) + static markup in `frontend/src/pages/landing/content.js`. No specific failing image/URL named.

## What I verified
Active run `3d97f6af-a4bc-4a55-b66d-c58f11ad6e53` (type=redeploy) succeeded at 2026-10-09T20:00:31Z and is the live/active run. frontend_type = cloudflare (static assets built and uploaded to R2, served by the CF worker).

**Production URL `https://qtrack-4.emergent.host` — live HTTP probes:**
- `/` → 200, real app HTML (correct <title>/SEO meta), NOT the nginx default page.
- `/images/hcci-logo.png` → 200, `image/png` (the NEW asset IS present and served).
- `/images/photo-field.jpg` (hero) → 200, `image/jpeg`.
- `/images/demo-poster.jpg` → 200, `image/jpeg`.
- `/video/quick-wing-demo.mp4` → 200, `video/mp4` (valid ftyp/moov header).
- `/quick-wing-logo.png` (root, used by Login/Contact/etc.) → 200, `image/png`.
- `/images/quick-wing-logo-wide.png` (nav/footer) → 200, `image/png`.
- `/images/app-dashboard.jpg` (default feature tab) → 200, `image/jpeg`.
- `/images/app-mobile-home.jpg` (phone) → 200, `image/jpeg`.
- `/images/hcci-award-lee-walker.jpg` → 200, `image/jpeg`.

**Source ↔ build cross-check (eph sandbox on this run's source):**
- Enumerated every asset referenced in `frontend/src` (incl. the dynamic `/images/${id}.jpg` feature/phone tabs). Feature ids: app-dashboard, app-booking, app-vehicles, app-reports, app-gps. Phone ids: app-mobile-home, app-mobile-bookings, app-mobile-docs, app-mobile-lift. All exist in `frontend/public/images`.
- Every other referenced image (photo-office, photo-mobile, bluebird-care-logo, ai-six-podcast, hcci-logo, hcci-award-*, quick-wing-logo-wide) exists in the build.
- Leaflet markers (`marker-icon*.png`, `marker-shadow.png`) are loaded from the cdnjs CDN, not locally — the earlier grep match was the CDN URL path, not a missing local asset.
- `public/sw.js` is push-notification only — no `fetch` handler, no Cache API — so it does NOT cache HTML/assets and cannot cause a stale/white render.

**Domains:** `quick-wing.com` and `www.quick-wing.com` both verified, SSL active (cloudflare), DNS A-records linked/propagated.

## Routing nuance (not a defect)
The CF worker returns `200` + `index.html` (SPA fallback) for an unknown `/images/*` path instead of a 404 (confirmed via `/images/marker-icon.png` → `content_type: text/html`). So a *missing* image would render as a broken `<img>`. However, no referenced landing image is missing — all resolve to real binary — so this fallback is not being triggered for any real reference.

## Root cause
No production static-asset availability or routing fault found. The latest deploy is live; the new `hcci-logo.png` and every other referenced image + the demo video are served correctly with valid content-types over both the default host and the custom domains. The reported "pure white / unfinished look" and "a lot of content on mobile" are visual/CSS/layout concerns (out of this scope, handled as normal code changes). A genuine "image doesn't load" on a single device, given assets are provably served, points to a client-side stale cache / network condition rather than the deployment.

## Suggested actions
1. User — hard-refresh / open in incognito / clear site data on the mobile device and re-check; if an image still fails, capture the exact failing URL + status in mobile DevTools (Network tab) so a specific asset can be re-checked. (All assets verified present server-side.)
2. Code (E1, out of my scope) — the mobile layout density, premium styling/white look, video placement, and removal of the 01/02 figures are source/CSS changes in `frontend/src/pages/landing/content.js` + styles; apply via normal code change + redeploy.

No redeploy or manifest change initiated (none warranted).
