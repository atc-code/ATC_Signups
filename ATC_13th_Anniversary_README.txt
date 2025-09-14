ATC 13th Anniversary Signup — CORS Fix (Manual Refresh + After Submit)
============================================================================

Why you saw "Network error":
- When the HTML runs from file:// or another domain, a JSON POST triggers a **CORS preflight (OPTIONS)** request.
- The Apps Script Web App doesn't handle that preflight, so the browser blocked the POST and showed "Network error".

What this version does:
- **Frontend** sends POST as **application/x-www-form-urlencoded** (a "simple" request — **no preflight**).
- **Backend** accepts **both** JSON and form-encoded bodies.
- Everything else stays the same: caps=5, confirmation emails, roster loads on page load + after submit + via the Refresh button.
- 60s server-side cache to reduce sheet reads.

Deploy steps:
1) Replace your Apps Script code with **Code_WITH_ROSTER_MANUAL_PLUS_AFTER_SUBMIT_CORS_FIX.gs** and Deploy → Web App.
2) Open/host **ATC_13thAnniversary_2025_Signups_ROSTER_MANUAL_PLUS_AFTER_SUBMIT_CORS_FIX.html** (ENDPOINT pre-filled).
3) Test:
   - Open the page → check badges show "5 left".
   - Submit a test (1 team) → row appears in Sheet, you get a confirmation email, roster updates.
   - Try the **Refresh** button.

Configured:
- SHEET_ID: 1-lZeAABGKI6OCkGZn0Bjy_d43F9GAL5RLH3vqd0NKLU
- ENDPOINT: https://script.google.com/macros/s/AKfycbwXU2Ve_2iUKTeeo_wxn8Xs-KDB4qgl-O7dvYFEv35txV_Fjan5AExcOldu3vGk-idW/exec
- Teams (order): Setup Team, Decoration team, Program leads, Slides, Live stream, Photography, Dinner coordinator, Dinner Serving team, Cleanup Team
- Cap per team: 5

Generated: 2025-09-14T18:59:12.940469
