ATC 13th Anniversary Signup — Ordered Roster (Team order + signup order)
=============================================================================

Included:
- **Roster shows teams in your original order**.
- **Within each team, names are shown in the order they signed up** (oldest first on top).
- Empty teams are hidden. If nobody has signed up yet, it shows “No signups yet.”
- No badges (“X left”) in the form, but full teams still auto-disable.
- Custom per-team caps and duplicate prevention (same email+phone cannot sign up for the same team twice).
- Roster updates on **page load** and **after submit**. No refresh button.
- CORS-friendly form-encoded POST; confirmation emails; 60s cache.

Deploy:
1) Apps Script → replace with **Code_HIDE_EMPTY_BADGELESS_ORDERED.gs** → Deploy Web App.
2) Use **ATC_13thAnniversary_2025_Signups_HIDE_EMPTY_BADGELESS_ORDERED.html** for your page.
3) Test: make a few signups to the same team — the earliest name should appear first.

Configured:
- SHEET_ID: 1-lZeAABGKI6OCkGZn0Bjy_d43F9GAL5RLH3vqd0NKLU
- ENDPOINT: https://script.google.com/macros/s/AKfycbwXU2Ve_2iUKTeeo_wxn8Xs-KDB4qgl-O7dvYFEv35txV_Fjan5AExcOldu3vGk-idW/exec
- Teams (order): Setup Team, Decoration team, Program leads, Slides, Live stream, Photography, Dinner coordinator, Dinner Serving team, Cleanup Team

Generated: 2025-09-14T20:49:22.528154
