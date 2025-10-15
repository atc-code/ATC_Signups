# ATC Christmas Carols — Signups (Dec 6, 13, 20, 2025)

**Version:** v1.2 — 2025-10-15

This package includes:
- **Google Apps Script backend** (`Code.gs`) for a Google Sheet.
- **Public signup page** (`index.html`, `styles.css`, `script.js`).
- **Admin dashboard** (`admin.html`, `admin.js`) for live rosters & exports.
- **Config CSVs** to make set-up easier.

> Dates included: **Dec 6, Dec 13, Dec 20, 2025** (editable in `script.js` and `admin.js`).  
> **Capacity:** Default **10 families per date** (change in `Config → CAPACITY_PER_DATE`).  
> **Blocklists:** `BLOCKED_EMAILS`, `BLOCKED_DOMAINS` now supported.

---

## 1) Google Sheet structure

### a) `Signups` (case-sensitive)
Row 1 headers (exact order):
```
timestamp, uuid, name, email, phone, area, party_size, preferred_date, host_meal, notes, user_agent, ip
```

### b) `Config`
Row 1 headers:
```
key, value
```

Suggested rows (edit as needed):
```
ALLOWED_DOMAINS, atlantateluguchurch.org;atc-volunteers.org
ALLOWED_EMAILS, 
BLOCKED_DOMAINS, 
BLOCKED_EMAILS, 
CLOSED_DATES, 
ADMIN_PASSCODE, 123456
CAPACITY_PER_DATE, 10
```

- Use **semicolon `;`** between entries.
- **Allowlists** (if set) restrict to those domains/emails.
- **Blocklists** deny specific domains/emails **regardless** of allowlists.

---

## 2) Members-only recipes

### A) Simple: restrict by church domain(s)
- Set `ALLOWED_DOMAINS` to:  
  `atlantateluguchurch.org;atc-volunteers.org`
- Leave `ALLOWED_EMAILS` blank.

### B) Strict roster: allow specific member emails only
- Leave `ALLOWED_DOMAINS` blank (optional).
- Set `ALLOWED_EMAILS` to a semicolon list of approved emails.

### C) Hybrid with exceptions
- Set `ALLOWED_DOMAINS` to your church domain(s).
- Use `BLOCKED_EMAILS` to explicitly deny addresses within those domains (e.g., former members).

### D) Fully open but exclude problem senders
- Leave allowlists blank.
- Fill `BLOCKED_EMAILS` or `BLOCKED_DOMAINS` for quick bans.

**Order of checks (server-side):**
1. **BLOCKED_EMAILS** and **BLOCKED_DOMAINS** → **deny immediately**.  
2. If `ALLOWED_EMAILS` has entries → email **must be in it**.  
3. Else if `ALLOWED_DOMAINS` has entries → email’s domain **must be in it**.  
4. Otherwise → allowed.

---

## 3) Backend endpoints
- `GET ?action=ping` → health/version.
- `GET ?action=availability` → per-date counts & remaining (uses `CAPACITY_PER_DATE`).
- `GET ?action=list&passcode=...&date=YYYY-MM-DD` → roster (optional date filter).
- `GET ?action=export&passcode=...` → CSV.
- `POST` JSON → create/update signup with capacity, allow/block lists, and closed-date checks.

---

## 4) Frontend behavior
- Shows only **dates with remaining slots** (auto-hides full dates).
- Captures optional **host meal**: `none | lunch | dinner`.
- Upserts by `(email, preferred_date)` to prevent duplicates.

---

## 5) Setup (quick)
1. Create the Sheet tabs as above; import `seed_config.csv` to `Config`.
2. Paste **`Code.gs`** into Apps Script; **Deploy → Web app** (execute as *Me*; access *Anyone with the link*).
3. Put your Web App URL into **`script.js`** and **`admin.js`** as `ENDPOINT`.
4. Host the static files anywhere (GitHub Pages works great).

---

## 6) Troubleshooting
- **“Date is full”** → increase `CAPACITY_PER_DATE` or choose another date.
- **“Email/domain not allowed”** → adjust allow/block lists in `Config`.
- **Nothing shows** → check exact header names/order in `Signups` tab.

