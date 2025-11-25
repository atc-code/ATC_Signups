// ATC_Christmas_Signup.gs
// RSVP backend with:
// - Google Sign-In verification (id_token)
// - Team caps & duplicate prevention
// - Roster + remaining counts
// - Submission lock after event date
// - Per-user aggregates (views/submits) in UserStats
// - Optional raw page views log
// - Blocklist to deny non-members (server-side)
//
// Update these constants for each event.

// ====== CONFIG ======
const SHEET_ID = '1lWnymJ1yijiyvwJxk-4gnYMqtKCSLw7M2Sjr9NzmdV4';
const SHEET_NAME = 'Signups';
const SUBMIT_LOG_SHEET = 'FormSubmissionsLog';

// Aggregated user metrics (one row per user)
const USER_STATS_SHEET = 'UserStats'; // columns: sub | email | views | submits | first_seen | last_seen

// Optional raw-views sheet (diagnostics). Keep false for performance.
const LOG_RAW_VIEWS = false;
const RAW_VIEWS_SHEET = 'PageViews';

// 🔒 Blocklist tab name (col A = email, B = optional notes)
const BLOCKLIST_SHEET = 'Blocklist';

// Event lock (submissions close after this moment)
const EVENT_DATE_ISO = '2025-12-25T23:59:59-04:00';

// OAuth client for verifying id_token (must match front-end)
const CLIENT_ID = '180743986209-prt051o1bp6namb57ababodokq0eadfv.apps.googleusercontent.com';

// Teams and caps
const TEAM_LIST = [
  'Setup Team','Decoration team','Program leads','Slides','Live stream',
  'Photography','Dinner coordinator','Dinner Serving team','Cleanup Team'
];
const TEAM_CAPS = {
  'Setup Team': 20,
  'Decoration team': 5,
  'Program leads': 5,
  'Slides': 2,
  'Live stream': 2,
  'Photography': 3,
  'Dinner coordinator': 5,
  'Dinner Serving team': 10,
  'Cleanup Team': 20
};


// ====== UTIL: Cache & JSON ======
function getCache() { return CacheService.getScriptCache(); }
function getCached(key) { const raw = getCache().get(key); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }
function setCached(key, obj, ttlSec) { try { getCache().put(key, JSON.stringify(obj), Math.min(ttlSec, 21600)); } catch (e) {} }
function createJson(obj, code) {
  var out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  if (typeof out.setStatusCode === 'function' && code) out.setStatusCode(code);
  return out;
}


// ====== AUTH ======
function verifyIdToken_(token) {
  if (!token) return { ok:false, code:401, error:'Missing id_token' };
  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  let info = {};
  try { info = JSON.parse(resp.getContentText() || '{}'); } catch (e) {}
  const issuerOk = info.iss === 'https://accounts.google.com' || info.iss === 'accounts.google.com';
  if (!issuerOk || info.aud !== CLIENT_ID) return { ok:false, code:403, error:'Invalid token' };
  return { ok:true, email: info.email || '', sub: info.sub || '' };
}
function requireAuth_(e) {
  const token = (e && e.parameter && e.parameter.id_token) ||
                (e && e.postData && e.postData.contents && (function(){
                  try { const j = JSON.parse(e.postData.contents); return j.id_token || ''; } catch(err){ return ''; }
                })());
  return verifyIdToken_(token);
}


// ====== BLOCKLIST ======
function ensureBlocklist_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(BLOCKLIST_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BLOCKLIST_SHEET);
    sh.appendRow(['email','notes','added_at']);
  }
  return sh;
}
function loadBlockedSet_() {
  const CK = 'blocked_set';
  const cached = getCached(CK);
  if (cached) return new Set(cached);
  const sh = ensureBlocklist_();
  const last = sh.getLastRow();
  const values = last > 1 ? sh.getRange(2,1,last-1,1).getValues() : [];
  const emails = values.map(r => String(r[0]||'').trim().toLowerCase()).filter(Boolean);
  setCached(CK, emails, 300);
  return new Set(emails);
}
function isBlocked_(email) {
  const em = String(email||'').trim().toLowerCase();
  if (!em) return false;
  return loadBlockedSet_().has(em);
}


// ====== SHEETS: Aggregated metrics ======
function ensureUserStats_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(USER_STATS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(USER_STATS_SHEET);
    sh.appendRow(['sub','email','views','submits','first_seen','last_seen']);
  }
  return sh;
}

function bumpUserCounters_(sub, email, deltas) {
  if (!sub) return; // must have stable key
  const sh   = ensureUserStats_();
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const finder = sh.createTextFinder(sub).matchEntireCell(true).findNext();
    const now = new Date();
    const emailLower = (email || '').toString().trim().toLowerCase();
    if (finder) {
      const row = finder.getRow();
      const curViews   = Number(sh.getRange(row, 3).getValue() || 0);
      const curSubmits = Number(sh.getRange(row, 4).getValue() || 0);
      const newViews   = curViews   + (deltas && deltas.viewsDelta   || 0);
      const newSubmits = curSubmits + (deltas && deltas.submitsDelta || 0);
      sh.getRange(row, 2, 1, 4).setValues([[emailLower, newViews, newSubmits, now]]);
    } else {
      const views   = (deltas && deltas.viewsDelta)   || 0;
      const submits = (deltas && deltas.submitsDelta) || 0;
      sh.appendRow([sub, emailLower, views, submits, now, now]);
    }
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


// ====== HTTP Handlers ======
function doGet(e) {
  const auth = requireAuth_(e);
  if (!auth.ok) return createJson({ ok:false, error:auth.error }, auth.code);

  // ⛔ deny all access for blocked emails
  if (isBlocked_(auth.email)) {
    return createJson({ ok:false, error:'Access restricted to ATC members. Please contact the coordinator.' }, 403);
  }

  const mode = (e && e.parameter && e.parameter.mode) || 'remaining';
  if (mode === 'view_breakdown') return createJson(getViewBreakdown_());
  if (mode === 'view_counts')    return createJson(getViewCounts_());
  if (mode === 'event_status')   return createJson({ ok:true, closed: (new Date() > new Date(EVENT_DATE_ISO)) });

  let bundle = getCached('roster_bundle');
  if (!bundle) { bundle = computeRosterBundle(); setCached('roster_bundle', bundle, 60); }
  if (mode === 'roster') return createJson({ ok: true, roster: bundle.roster, counts: bundle.counts, caps: TEAM_CAPS });
  return createJson({ ok: true, remaining: computeRemainingFromCounts(bundle.counts), caps: TEAM_CAPS });
}

function doPost(e) {
  const auth = requireAuth_(e);
  if (!auth.ok) return createJson({ ok:false, error:auth.error }, auth.code);

  // ⛔ block all POSTs for blocked emails
  if (isBlocked_(auth.email)) {
    return createJson({ ok:false, error:'Access restricted to ATC members. Please contact the coordinator.' }, 403);
    // Note: do not increment views/submits for blocked users
  }

  // ✅ Always allow view logging (even after RSVPs close)
  if (e && e.parameter && e.parameter.mode === 'log_view') {
    return handleLogView_(e, auth.email || '');
  }

  // ⛔ Block form submissions after event
  if (new Date() > new Date(EVENT_DATE_ISO)) {
    return createJson({ ok:false, error:'Signup is now closed — the event has concluded. Thank you for serving!' }, 403);
  }

  try {
    // Parse inputs
    var payload = {};
    var ctype = (e.postData && e.postData.type) || '';
    if (ctype && ctype.indexOf('application/json') === 0) {
      payload = JSON.parse(e.postData.contents || '{}');
    } else {
      payload.name = (e.parameter.name || '').trim();
      payload.firstName = (e.parameter.firstName || '').trim();
      payload.lastName = (e.parameter.lastName || '').trim();
      payload.email = (e.parameter.email || '').trim();
      payload.phone = (e.parameter.phone || '').trim();
      payload.comments = (e.parameter.comments || '').trim();
      if (e.parameters && e.parameters.teams) payload.teams = e.parameters.teams;
      else if (e.parameter.teams) payload.teams = [e.parameter.teams];
      else payload.teams = [];
    }

    const firstName = (payload.firstName || '').trim();
    const lastName  = (payload.lastName  || '').trim();
    let   name      = (payload.name      || '').trim();
    const email     = (payload.email     || '').trim();
    const phone     = (payload.phone     || '').trim();
    const comments  = (payload.comments  || '').trim();
    const teams     = Array.isArray(payload.teams) ? payload.teams : [];

    if (firstName && lastName) name = firstName + ' ' + lastName;

    if (!firstName || !lastName || !email || !phone || teams.length === 0) {
      logSubmit_(auth.email || email, name, teams, 'error', 'Missing required fields');
      return createJson({ ok: false, error: 'Please enter a valid First and Last Name, email, phone, and select at least one team.' }, 400);
    }
    const re = /^[A-Za-z][A-Za-z\s\-']{3,}$/;
    if (!re.test(firstName) || !re.test(lastName)) {
      logSubmit_(auth.email || email, name, teams, 'error', 'Invalid first/last');
      return createJson({ ok: false, error: 'Please enter a valid First and Last Name (at least 4 letters each).' }, 400);
    }

    const invalid = teams.filter(t => TEAM_LIST.indexOf(t) === -1);
    if (invalid.length) { logSubmit_(auth.email || email, name, teams, 'error', 'Invalid team(s)'); return createJson({ ok: false, error: 'Invalid team(s): ' + invalid.join(', ') }, 400); }

    // Compute remaining and duplicates
    let bundle = getCached('roster_bundle') || computeRosterBundle();
    const dupTeams = findDuplicateTeamsForPerson(email, phone, teams);
    if (dupTeams.length) {
      logSubmit_(auth.email || email, name, teams, 'error', 'Duplicate: ' + dupTeams.join(', '));
      return createJson({ ok: false, error: 'You are already signed up for: ' + dupTeams.join(', ') + '. You can pick other team(s).' }, 409);
    }
    const remaining = computeRemainingFromCounts(bundle.counts);
    const full = teams.filter(t => (remaining[t] || 0) <= 0);
    if (full.length) {
      logSubmit_(auth.email || email, name, teams, 'error', 'Full: ' + full.join(', '));
      return createJson({ ok: false, error: 'These team(s) are full: ' + full.join(', ') + '. Please pick others.' }, 409);
    }

    // Append to Signups
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    sh.appendRow([new Date(), name, email, phone, teams.join(', '), comments]);

    // Refresh roster cache
    bundle = computeRosterBundle();
    setCached('roster_bundle', bundle, 60);

    // Confirmation email (best-effort)
    try {
      const subject = 'Thanks for serving — ATC Christmas 2025';
      const lines = [];
      lines.push('Hi ' + name + ',');
      lines.push('');
      lines.push('Thank you for your Signup to serve at ATC Christmas  (Thu, Dec - 25, 2025).');
      lines.push('Teams: ' + teams.join(', '));
      lines.push('');
      lines.push('We\'re grateful for you — God bless!');
      MailApp.sendEmail({ to: email, subject, body: lines.join('\n') });
    } catch (mailErr) {}

    // Log submit & bump aggregate submits
    logSubmit_(auth.email || email, name, teams, 'ok', '');
    bumpUserCounters_(auth.sub, email, { submitsDelta: 1 });

    return createJson({ ok: true, message: 'Saved', remaining: computeRemainingFromCounts(bundle.counts) });
  } catch (err) {
    logSubmit_('', '', [], 'error', String(err));
    return createJson({ ok: false, error: String(err) }, 500);
  }
}


// ====== View logging (aggregated) ======
function handleLogView_(e, emailFromToken) {
  try {
    const tok  = (e && e.parameter && e.parameter.id_token) || '';
    const auth = verifyIdToken_(tok);
    if (auth && auth.ok) bumpUserCounters_(auth.sub, auth.email || emailFromToken, { viewsDelta: 1 });

    if (LOG_RAW_VIEWS) {
      const path = (e.parameter && e.parameter.path) || '';
      const ua   = (e.parameter && e.parameter.ua)   || '';
      const kind = (e.parameter && e.parameter.kind) || 'load';
      const ss = SpreadsheetApp.openById(SHEET_ID);
      let sh = ss.getSheetByName(RAW_VIEWS_SHEET);
      if (!sh) { sh = ss.insertSheet(RAW_VIEWS_SHEET); sh.appendRow(['Timestamp','Email','Path','Kind','UserAgent']); }
      sh.appendRow([new Date(), (auth.email || emailFromToken || ''), path, kind, ua]);
    }
    return createJson({ ok: true });
  } catch (err) {
    return createJson({ ok: false, error: String(err) }, 500);
  }
}


// ====== Metrics (reads from aggregates) ======
function getViewBreakdown_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const agg = ss.getSheetByName(USER_STATS_SHEET);
  const rows = [];
  let totalViews = 0;
  let totalSubmits = 0;

  if (agg) {
    const v = agg.getDataRange().getValues(); // sub,email,views,submits,first_seen,last_seen
    for (let r = 1; r < v.length; r++) {
      const email = (v[r][1] || '').toString().trim().toLowerCase();
      const views = Number(v[r][2] || 0);
      const subs  = Number(v[r][3] || 0);
      if (email) {
        rows.push({ email, views, submits: subs });
        totalViews += views;
        totalSubmits += subs;
      }
    }
  }
  rows.sort((a,b) => a.email.localeCompare(b.email));
  const unique = rows.length;
  return { ok:true, rows, totalViews, totalSubmits, unique };
}

// Optional: totals by day if your front-end still calls it
function getViewCounts_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const agg = ss.getSheetByName(USER_STATS_SHEET);
  if (!agg) return { ok:true, total:0, unique:0, today:0 };
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const v = agg.getDataRange().getValues();
  let total = 0, unique = 0, today = 0;
  for (let r = 1; r < v.length; r++) {
    const views = Number(v[r][2] || 0);
    const last  = v[r][5];
    if (views > 0) { total += views; unique++; }
    if (last) {
      const s = Utilities.formatDate(new Date(last), tz, 'yyyy-MM-dd');
      if (s === todayStr) today++;
    }
  }
  return { ok:true, total, unique, today };
}


// ====== Roster helpers ======
function computeRemainingFromCounts(counts) {
  const remaining = {};
  TEAM_LIST.forEach(function(t) { const cap = TEAM_CAPS[t] || 0; remaining[t] = Math.max(0, cap - (counts[t] || 0)); });
  return remaining;
}
function computeRosterBundle() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sh.getDataRange().getValues();
  const counts = {};
  const roster = {};
  TEAM_LIST.forEach(function(t) { counts[t] = 0; roster[t] = []; });
  for (var r = 1; r < values.length; r++) {
    var name = (values[r][1] || '').toString().trim();
    var teamsCell = (values[r][4] || '').toString();
    var teams = teamsCell.split(/\s*,\s*/).filter(Boolean);
    teams.forEach(function(t) { if (TEAM_LIST.indexOf(t) !== -1) { counts[t]++; if (name) roster[t].push(name); } });
  }
  return { counts: counts, roster: roster };
}
function findDuplicateTeamsForPerson(email, phone, requestedTeams) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sh.getDataRange().getValues();
  const normEmail = (email || '').trim().toLowerCase();
  const normPhone = (phone || '').replace(/\D/g, '');
  const dup = {};
  requestedTeams.forEach(function(t) { dup[t] = false; });
  for (var r = 1; r < values.length; r++) {
    var rowEmail = (values[r][2] || '').toString().trim().toLowerCase();
    var rowPhone = (values[r][3] || '').toString().replace(/\D/g, '');
    if (rowEmail === normEmail && rowPhone === normPhone) {
      var teamsCell = (values[r][4] || '').toString();
      var teams = teamsCell.split(/\s*,\s*/).filter(Boolean);
      teams.forEach(function(t) { if (dup.hasOwnProperty(t)) dup[t] = true; });
    }
  }
  return Object.keys(dup).filter(function(t){ return dup[t]; });
}
function logSubmit_(email, name, teams, status, err) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SUBMIT_LOG_SHEET);
  if (!sh) { sh = ss.insertSheet(SUBMIT_LOG_SHEET); sh.appendRow(['Timestamp','Email','Name','Teams','Status','Error']); }
  sh.appendRow([new Date(), email, name, (teams||[]).join(', '), status, err]);
}
