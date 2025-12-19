// ATC_Christmas_Signup_HardcodedTeams.gs
//
// Backend for ATC Christmas Signup
//
// - Google Sign-In via id_token
// - Teams & caps defined in TEAM_LIST / TEAM_CAPS below (NO Teams sheet)
// - Signups written to "Signups" sheet
// - Roster + remaining counts
// - Blocklist via "Blocklist" sheet
// - Per-user aggregates for views/submits in "UserStats"
// - Optional raw page views logging in "PageViews"

// ===== CONFIG =====
const SHEET_ID = '1lWnymJ1yijiyvwJxk-4gnYMqtKCSLw7M2Sjr9NzmdV4';

const SIGNUPS_SHEET_NAME    = 'Signups';
const BLOCKLIST_SHEET_NAME  = 'Blocklist';
const USER_STATS_SHEET      = 'UserStats';   // sub | email | views | submits | last_seen
const LOG_RAW_VIEWS         = false;        // set true if you want raw logs
const RAW_VIEWS_SHEET       = 'PageViews';

const EVENT_DATE_ISO        = '2025-12-25T23:59:59-05:00';
const CLIENT_ID             = '180743986209-prt051o1bp6namb57ababodokq0eadfv.apps.googleusercontent.com';

// ===== TEAM CONFIG (EDIT HERE WHEN YOU WANT TO CHANGE TEAMS) =====
const TEAM_LIST = [
  'Setup Team',
  'Decoration team',
  'Program leads',
  'Slides',
  'Live stream',
  'Photography',
  'Dinner coordinator',
  'Dinner Serving team',
  'Cleanup Team'
];

const TEAM_CAPS = {
  'Setup Team':          20,
  'Decoration team':      5,
  'Program leads':        5,
  'Slides':               2,
  'Live stream':          2,
  'Photography':          3,
  'Dinner coordinator':   5,
  'Dinner Serving team': 10,
  'Cleanup Team':        20
};
// ===== END TEAM CONFIG =====

function isValidEmail_(email) {
  email = (email || '').toString().trim();
  if (!email) return false;
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidPhone_(phone) {
  var digits = (phone || '').toString().replace(/\D/g, '');

  // Must be exactly 10 digits
  if (digits.length !== 10) return false;

  // Explicitly banned sequences
  var badSequences = [
    '0000000000',
    '1111111111',
    '2222222222',
    '3333333333',
    '4444444444',
    '5555555555',
    '6666666666',
    '7777777777',
    '8888888888',
    '9999999999',
    '0123456789',
    '1234567890',
    '9876543210',
    '0987654321'
  ];
  if (badSequences.indexOf(digits) !== -1) return false;

  // 1) Reject all-same digit (extra safety)
  var first = digits.charAt(0);
  var allSame = true;
  for (var i = 1; i < digits.length; i++) {
    if (digits.charAt(i) !== first) {
      allSame = false;
      break;
    }
  }
  if (allSame) return false;

  // 2) Reject strictly increasing or decreasing by 1
  var inc = true;
  var dec = true;
  for (var j = 1; j < digits.length; j++) {
    var diff = Number(digits.charAt(j)) - Number(digits.charAt(j - 1));
    if (diff !== 1) inc = false;
    if (diff !== -1) dec = false;
  }
  if (inc || dec) return false;

  return true;
}

// ===== Utility: cache + JSON =====
function getCache_() { return CacheService.getScriptCache(); }

function getCached_(key) {
  const raw = getCache_().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function setCached_(key, value, seconds) {
  try {
    getCache_().put(key, JSON.stringify(value), seconds || 300);
  } catch (e) {}
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(msg) {
  return json_({ ok:false, error:String(msg || 'Unknown error') });
}

// ===== Auth: verify Google id_token =====
function verifyIdToken_(idToken) {
  idToken = (idToken || '').toString().trim();
  if (!idToken) throw new Error('Missing id_token');

  const url  = 'https://oauth2.googleapis.com/tokeninfo?id_token=' +
               encodeURIComponent(idToken);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions:true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Invalid id_token');
  }
  const data = JSON.parse(resp.getContentText() || '{}');
  if (!data.aud || data.aud !== CLIENT_ID) {
    throw new Error('Invalid id_token (audience mismatch)');
  }
  if (!data.email && !data.sub) {
    throw new Error('Invalid id_token (no user)');
  }
  return {
    email: (data.email || '').toString().trim(),
    sub:   (data.sub   || '').toString().trim(),
    name:  (data.name  || '').toString().trim()
  };
}

// ===== Sheets helpers =====
function getSpreadsheet_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function ensureSignupsSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(SIGNUPS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SIGNUPS_SHEET_NAME);
    sh.appendRow(['Timestamp','FirstName','LastName','Email','Phone','Teams','Comments']);
  }
  return sh;
}

function ensureBlocklistSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(BLOCKLIST_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(BLOCKLIST_SHEET_NAME);
    sh.appendRow(['Email','Notes','Added_at']);
  }
  return sh;
}

function ensureUserStatsSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(USER_STATS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(USER_STATS_SHEET);
    sh.appendRow(['sub','email','views','submits','last_seen']);
  }
  return sh;
}

function ensureRawViewsSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(RAW_VIEWS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(RAW_VIEWS_SHEET);
    sh.appendRow(['Timestamp','Email','Path','Kind','UserAgent']);
  }
  return sh;
}

// ===== Blocklist =====
function loadBlockedSet_() {
  const CK = 'blocked_emails_v1';
  const cached = getCached_(CK);
  if (cached) return new Set(cached);

  const sh   = ensureBlocklistSheet_();
  const last = sh.getLastRow();
  const vals = last > 1 ? sh.getRange(2,1,last-1,1).getValues() : [];
  const emails = vals
    .map(r => String(r[0] || '').trim().toLowerCase())
    .filter(Boolean);

  setCached_(CK, emails, 300);
  return new Set(emails);
}

function isBlocked_(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return false;
  return loadBlockedSet_().has(em);
}

// ===== Aggregated metrics =====
function bumpUserCounters_(sub, email, deltas) {
  if (!sub) return;
  const sh   = ensureUserStatsSheet_();
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const data = sh.getDataRange().getValues();
    let foundRow = -1;
    for (let r = 1; r < data.length; r++) {
      if ((data[r][0] || '').toString() === sub) {
        foundRow = r + 1; // 1-based
        break;
      }
    }
    const now        = new Date();
    const emailLower = (email || '').toString().trim().toLowerCase();
    const dv         = (deltas && deltas.viewsDelta)   || 0;
    const ds         = (deltas && deltas.submitsDelta) || 0;

    if (foundRow > 0) {
      const curViews   = Number(sh.getRange(foundRow,3).getValue() || 0);
      const curSubmits = Number(sh.getRange(foundRow,4).getValue() || 0);
      const newViews   = curViews   + dv;
      const newSubmits = curSubmits + ds;
      sh.getRange(foundRow, 2, 1, 4).setValues([
        [emailLower || data[foundRow-1][1], newViews, newSubmits, now]
      ]);
    } else {
      sh.appendRow([sub, emailLower, dv, ds, now]);
    }
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getViewBreakdown_() {
  const sh   = ensureUserStatsSheet_();
  const data = sh.getDataRange().getValues();
  const rows = [];
  let totalViews = 0;
  let totalSubmits = 0;

  for (let r = 1; r < data.length; r++) {
    const email  = String(data[r][1] || '').trim().toLowerCase();
    const views  = Number(data[r][2] || 0);
    const subs   = Number(data[r][3] || 0);
    if (!email) continue;
    rows.push({ email: email, views: views, submits: subs });
    totalViews   += views;
    totalSubmits += subs;
  }
  rows.sort((a,b) => a.email.localeCompare(b.email));
  return {
    ok: true,
    rows,
    totalViews,
    totalSubmits,
    unique: rows.length
  };
}

// ===== View logging =====
function handleLogView_(user, params) {
  try {
    if (user && user.sub) {
      bumpUserCounters_(user.sub, user.email, { viewsDelta:1, submitsDelta:0 });
    }
    if (LOG_RAW_VIEWS) {
      const path = (params.path || '').toString();
      const ua   = (params.ua   || '').toString();
      const kind = (params.kind || 'load').toString();
      const sh   = ensureRawViewsSheet_();
      sh.appendRow([new Date(), (user.email || ''), path, kind, ua]);
    }
    return json_({ ok:true });
  } catch (err) {
    return error_(err && err.message || err);
  }
}

// ===== Roster / remaining using TEAM_LIST / TEAM_CAPS =====
function computeRosterAndRemaining_() {
  const list = TEAM_LIST;
  const caps = TEAM_CAPS;

  const sh    = ensureSignupsSheet_();
  const last  = sh.getLastRow();
  const vals  = last > 1 ? sh.getRange(2,1,last-1,7).getValues() : [];

  const roster = {};
  const counts = {};
  list.forEach(t => { roster[t] = []; counts[t] = 0; });

  for (let r = 0; r < vals.length; r++) {
    const row      = vals[r];
    const first    = String(row[1] || '').trim();
    const lastName = String(row[2] || '').trim();
    const email    = String(row[3] || '').trim();
    const name     = (first + ' ' + lastName).trim() || email;
    const teamsStr = String(row[5] || '');
    if (!teamsStr) continue;
    const teams = teamsStr.split(/\s*,\s*/).filter(Boolean);

    teams.forEach(t => {
      if (list.indexOf(t) === -1) return;
      counts[t] = (counts[t] || 0) + 1;
      if (name) roster[t].push(name);
    });
  }

  const remaining = {};
  list.forEach(t => {
    const cap = caps[t];
    if (typeof cap === 'number' && cap > 0) {
      const used = counts[t] || 0;
      remaining[t] = Math.max(0, cap - used);
    } else {
      remaining[t] = null; // no cap
    }
  });

  return { teams:list, roster, remaining };
}

function findDuplicateTeamsForPerson_(email, phone, requestedTeams) {
  const sh   = ensureSignupsSheet_();
  const last = sh.getLastRow();
  const vals = last > 1 ? sh.getRange(2,1,last-1,7).getValues() : [];

  const normEmail = (email || '').trim().toLowerCase();
  const normPhone = (phone || '').replace(/\D/g, '');

  const dupFlags = {};
  requestedTeams.forEach(t => dupFlags[t] = false);

  for (let r = 0; r < vals.length; r++) {
    const row      = vals[r];
    const rowEmail = String(row[3] || '').trim().toLowerCase();
    const rowPhone = String(row[4] || '').replace(/\D/g, '');
    if (!rowEmail && !rowPhone) continue;

    if ((normEmail && rowEmail === normEmail) ||
        (normPhone && rowPhone === normPhone)) {
      const teamsStr = String(row[5] || '');
      if (!teamsStr) continue;
      const teams = teamsStr.split(/\s*,\s*/).filter(Boolean);
      teams.forEach(t => { if (dupFlags.hasOwnProperty(t)) dupFlags[t] = true; });
    }
  }

  return Object.keys(dupFlags).filter(t => dupFlags[t]);
}

// ===== HTTP: GET =====
function doGet(e) {
  try {
    const params  = e && e.parameter ? e.parameter : {};
    const mode    = (params.mode || '').toString().trim();
    const idToken = (params.id_token || '').toString().trim();
    if (!idToken) return error_('id_token required');

    const user  = verifyIdToken_(idToken);
    const email = user.email;

    if (isBlocked_(email)) {
      return json_({
        ok: false,
        error: 'Access restricted to ATC members. Please contact the coordinator.'
      });
    }

    if (mode === 'view_breakdown') {
      return json_(getViewBreakdown_());
    }

    const bundle = computeRosterAndRemaining_();
    const closed = (new Date() > new Date(EVENT_DATE_ISO));

    if (mode === 'roster') {
      return json_({
        ok: true,
        teams: bundle.teams,
        roster: bundle.roster,
        remaining: bundle.remaining,
        closed: closed
      });
    }

    // default: availability only
    return json_({
      ok: true,
      teams: bundle.teams,
      remaining: bundle.remaining,
      closed: closed
    });

  } catch (err) {
    return error_(err && err.message || err);
  }
}

// ===== HTTP: POST =====
function doPost(e) {
  try {
    const params  = e && e.parameter ? e.parameter : {};
    const mode    = (params.mode || '').toString().trim();
    const idToken = (params.id_token || '').toString().trim();
    if (!idToken) return error_('id_token required');

    const user = verifyIdToken_(idToken);
    if (isBlocked_(user.email)) {
      return json_({
        ok: false,
        error: 'Access restricted to ATC members. Please contact the coordinator.'
      });
    }

    if (mode === 'log_view') {
      return handleLogView_(user, params);
    }

    // ---- handle signup submit ----
    const now = new Date();
    if (now > new Date(EVENT_DATE_ISO)) {
      return json_({
        ok: false,
        error: 'Signup is closed — the event has concluded. Thank you for serving!'
      });
    }

    const firstName   = (params.firstName || '').toString().trim();
    const lastName    = (params.lastName  || '').toString().trim();
    const nameFromForm= (params.name     || '').toString().trim();
    const email       = (params.email    || '').toString().trim().toLowerCase();
    const phone       = (params.phone    || '').toString().trim();
    const comments    = (params.comments || '').toString().trim();

    let teamsRaw = [];
    if (e.parameters && e.parameters.teams) {
      const t = e.parameters.teams;
      teamsRaw = Array.isArray(t) ? t : [t];
    } else if (params.teams) {
      teamsRaw = [params.teams];
    }

    let teams = teamsRaw
      .map(x => x.toString().trim())
      .filter(Boolean);

    if (!teams.length) {
      return json_({ ok:false, error:'At least one team must be selected.' });
    }

    // Validate against TEAM_LIST
    const invalid = teams.filter(t => TEAM_LIST.indexOf(t) === -1);
    if (invalid.length) {
      return json_({ ok:false, error:'Invalid team(s): ' + invalid.join(', ') });
    }

    // De-dupe
    teams = Array.from(new Set(teams));

    const namePattern = /^[A-Za-z][A-Za-z\s\-']{3,}$/;
    if (!namePattern.test(firstName) || !namePattern.test(lastName)) {
      return json_({
        ok:false,
        error:'Please enter a valid First and Last Name (at least 4 letters each).'
      });
    }

    if (!isValidEmail_(email)) {
      return json_({ ok:false, error:'Please enter a valid email address.' });
    }
    
    var emailFromToken = (user.email || '').toString().trim().toLowerCase();
    if (!emailFromToken || email !== emailFromToken) {
    return json_({
    ok:false,
    error:'Email mismatch: please use the same email address you used to sign in with Google.'
    });
    }

    if (!isValidPhone_(phone)) {
      return json_({
        ok:false,
        error:'Please enter a valid 10-digit phone number (e.g., (404) 555-1234).'
      });
    }

    const fullName = (nameFromForm || (firstName + ' ' + lastName)).trim();

    const lock = LockService.getScriptLock();
    lock.tryLock(5000);
    try {
      const bundle = computeRosterAndRemaining_();

      const dupTeams = findDuplicateTeamsForPerson_(email, phone, teams);
      if (dupTeams.length) {
        return json_({
          ok:false,
          error:'You are already signed up for: ' + dupTeams.join(', ') +
                '. You can pick other team(s).'
        });
      }

      const remaining = bundle.remaining;
      const fullTeams = teams.filter(t => {
        const left = remaining[t];
        return (typeof left === 'number' && left <= 0);
      });
      if (fullTeams.length) {
        return json_({
          ok:false,
          error:'These team(s) are full: ' + fullTeams.join(', ') +
                '. Please pick others.'
        });
      }

      const sh = ensureSignupsSheet_();
      sh.appendRow([
        now,
        firstName,
        lastName,
        email,
        phone,
        teams.join(', '),
        comments
      ]);
    } finally {
      try { lock.releaseLock(); } catch (e2) {}
    }

    bumpUserCounters_(user.sub, email, { viewsDelta:0, submitsDelta:1 });

    // Confirmation email (best-effort)
    try {
      if (email) {
        const eventDateText = 'Thu, Dec 25, 2025';
        const subject = 'Thanks for serving — ATC Christmas 2025';
        const lines = [];
        lines.push('Hi ' + fullName + ',');
        lines.push('');
        lines.push('Thank you for your signup to serve at ATC Christmas Service (' + eventDateText + ').');
        lines.push('Teams: ' + teams.join(', '));
        lines.push('');
        lines.push('We appreciate your heart to serve. We will reach out with any additional details.');
        const bodyText = lines.join('\n');
        MailApp.sendEmail({
          to: email,
          subject: subject,
          body: bodyText,
          name: 'ATC Signup'
        });
      }
    } catch (mailErr) {
      // ignore email failures
    }

    return json_({ ok:true });
  } catch (err) {
    return error_(err && err.message || err);
  }
}
