ATC 13th Anniversary Signup — UPDATED (Teams + IDs set)
==============================================================

Configured for:
- SHEET_ID: 1-lZeAABGKI6OCkGZn0Bjy_d43F9GAL5RLH3vqd0NKLU
- Web App URL (ENDPOINT): https://script.google.com/macros/s/AKfycbwXU2Ve_2iUKTeeo_wxn8Xs-KDB4qgl-O7dvYFEv35txV_Fjan5AExcOldu3vGk-idW/exec
- Teams: Setup Team, Decoration team, Program leads, Slides, Live stream, Photography, Dinner coordinator, Dinner Serving team, Cleanup Crew
- Cap per team: 5

How to deploy:
1) In Google Sheets, make sure you have a sheet named "13th Anniversary Sign-Ups" with a tab "Signups"
   and headers: Timestamp | Name | Email | Phone | Teams | Comments.
2) Extensions → Apps Script → paste Code_UPDATED.gs and save.
3) Deploy → New Deployment (or Manage deployments → Edit) → Web App
   - Execute as: Me
   - Who has access: Anyone (or Anyone with link)
4) Open ATC_13thAnniversary_2025_Signups_UPDATED.html locally or host it.
   (It already contains your ENDPOINT and team names.)

Notes:
- The page shows “X spot(s) left)” based on GET /exec JSON.
- If the backend is unreachable, checkboxes stay enabled (“Spots available”).

Generated: 2025-09-14T17:54:25.982224
