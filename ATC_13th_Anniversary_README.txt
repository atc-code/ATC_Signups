ATC 13th Anniversary Signup — Roster: Manual Refresh + After Submit
======================================================================

Behavior:
- Roster loads **once** on page load.
- Roster also refreshes **after each form submit** (success or error).
- A **Refresh** button lets you update the roster on demand.
- No auto-interval; no focus-based refresh. Low traffic by default.
- Backend caches roster/counts for **60s** to reduce sheet reads.

Renamed team:
- "Cleanup Crew" → **"Cleanup Team"** (updated both frontend + backend)

Deploy:
1) Paste **Code_WITH_ROSTER_MANUAL_PLUS_AFTER_SUBMIT.gs** into Apps Script and Deploy → Web App.
2) Open/host **ATC_13thAnniversary_2025_Signups_ROSTER_MANUAL_PLUS_AFTER_SUBMIT.html** (ENDPOINT pre-filled).
3) Ensure your Google Sheet tab is named **Signups** with headers:
   Timestamp | Name | Email | Phone | Teams | Comments

Configured:
- SHEET_ID: 1-lZeAABGKI6OCkGZn0Bjy_d43F9GAL5RLH3vqd0NKLU
- ENDPOINT: https://script.google.com/macros/s/AKfycbwXU2Ve_2iUKTeeo_wxn8Xs-KDB4qgl-O7dvYFEv35txV_Fjan5AExcOldu3vGk-idW/exec
- Teams (order): Setup Team, Decoration team, Program leads, Slides, Live stream, Photography, Dinner coordinator, Dinner Serving team, Cleanup Team
- Cap per team: 5

Generated: 2025-09-14T18:47:05.729208
