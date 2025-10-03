What is this ?

A secure RSVP/signup page for your church anniversary that:

shows the form only after Google sign-in,

enforces per-team capacity and blocks duplicate signups,

shows a live roster (names only) in your chosen team order,

emails confirmations,

logs page views and submissions to the same Google Sheet,

shows admins a tiny “Views • People” badge.

Frontend (HTML page)

Google Sign-In gate: Uses your Client ID. Until users sign in, the page is hidden.

Form fields: First Name, Last Name (both ≥3 chars & validated), Email, optional Phone + Comments, and checkboxes for teams (your custom order).

Capacity awareness: On load (and after submit), it fetches availability; full teams’ checkboxes are disabled.

Submit flow: Posts the RSVP (name, email, phone, comments, selected teams) to your Apps Script with a Google ID token.

Roster: Fetches mode=roster and shows volunteers per team in your order. Within each team, names appear in signup order (earliest first).

Footer message: Always shows “Thank you for serving! … God bless you!”

Post-event banner: (Optional extra) After the second Monday following the event date, a “Thank you for serving!” banner can appear at the top.

Admin badge: If the signed-in email is in ADMIN_EMAILS, shows a small chip with total views and unique visitors (via mode=view_counts).

Backend (Apps Script)

Auth required for all calls: Every GET/POST must include a valid Google ID token for your Client ID; otherwise request is rejected.

Reads:

GET default → returns remaining slots per team (based on your caps).

GET?mode=roster → returns roster (names per team).

GET?mode=view_counts → returns totals for the admin badge (total page views / unique emails today+overall, depending on version).

Writes:

POST submission → validates names, verifies teams, blocks duplicate on same email+phone+team, enforces capacity, appends the row to Signups sheet, sends a confirmation email, and returns updated remaining.

POST mode=log_view → appends a row in PageViews with timestamp, verified email (from token), path, kind, and user agent.

Also logs each submission attempt (success or error) to FormSubmissionsLog with status and error reason.

Data in your Google Sheet

Signups (existing):
Timestamp | Name | Email | Phone | Teams (comma-separated) | Comments

PageViews (new):
Timestamp | Email | Path | Kind | UserAgent

FormSubmissionsLog (new):
Timestamp | Email | Name | Teams | Status(ok/error) | Error

Guardrails & logic

Name validation: First/Last must be letters/space/‘-’/apostrophe, min length 3 each.

Duplicate prevention: Same email + phone cannot sign up on the same team twice.

Team capacity: Custom caps per team; if full, submissions are blocked and the checkbox is disabled on the page.

Caching: Roster/counts are cached briefly server-side to cut Sheet reads (auto-refreshes after each submit).

Email confirmations: Sent via MailApp.sendEmail on successful submit.




ATC RSVP — Secure + Logs + Admin Counter (Minimal Additions)
=================================================================
This package adds three things with minimal code:
1) **Secure backend**: requires a valid Google **ID token** for **all** reads/writes.
2) **Submission log**: every submit attempt is recorded on a `FormSubmissionsLog` sheet (status ok/error).
3) **View tracking + admin badge**: page views are logged to `PageViews`; admins see a small "Views • People" badge.

What to replace
---------------
- **Apps Script** → replace code with `Code_RSVP_SECURE_LOGS.gs`, then **Deploy → Web app** (execute as: Me; access: Anyone)
- **HTML page** → publish `ATC_13thAnniversary_2025_RSVP.html`

One edit you must do
--------------------
Open the HTML and set:
- `ADMIN_EMAILS = ["paste-your-admin-email@domain.com"]`  ← replace with your email(s).

How it works
------------
- After Google sign-in, the page gets an **ID token**. All API calls include `id_token`.
- Apps Script verifies the token (`CLIENT_ID`-bound) and rejects anonymous calls.
- `PageViews` sheet gets a row on each signed-in load.
- Admins see a small badge with total views and unique emails, via `mode=view_counts`.

Sheets used
-----------
- **Signups** (existing): actual RSVPs (no schema change).
- **FormSubmissionsLog** (new): Timestamp, Email, Name, Teams, Status, Error.
- **PageViews** (new): Timestamp, Email, Path, Kind, UserAgent.

