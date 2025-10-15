/**
 * ATC Christmas Carols Signups — Google Apps Script backend
 * v1.2 (2025-10-15)
 *
 * Sheet structure:
 *  - Signups: timestamp, uuid, name, email, phone, area, party_size, preferred_date, host_meal, notes, user_agent, ip
 *  - Config: key, value
 */

const SHEET_SIGNUPS = 'Signups';
const SHEET_CONFIG = 'Config';
const UPSERT_BY_EMAIL_AND_DATE = true; // uniqueness on (email, preferred_date)
const DEFAULT_CAPACITY_PER_DATE = 10;

function doOptions(e) {
  return withCors(ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT));
}

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping').toLowerCase();
    if (action === 'ping') {
      return withCors(json({ ok: true, now: new Date(), version: '1.2' }));
    }
    if (action === 'availability') {
      const counts = countByDate();
      const cap = getConfig().CAPACITY_PER_DATE || DEFAULT_CAPACITY_PER_DATE;
      const arr = Object.keys(counts).map(d => ({date:d, count:counts[d], capacity:cap, remaining: Math.max(0, cap - counts[d])}));
      return withCors(json({ ok: true, capacity: cap, dates: arr, counts }));
    }
    if (action === 'list') {
      const pass = e.parameter.passcode || '';
      guardAdmin(pass);

      const date = (e.parameter.date || '').trim(); // YYYY-MM-DD or ''
      const rows = getAllRows();
      const filtered = date ? rows.filter(r => r.preferred_date === date) : rows;
      return withCors(json({ ok: true, rows: filtered, count: filtered.length }));
    }
    if (action === 'export') {
      const pass = e.parameter.passcode || '';
      guardAdmin(pass);

      const rows = getAllRows();
      const csv = rowsToCsv(rows);
      const out = ContentService.createTextOutput(csv);
      out.setMimeType(ContentService.MimeType.CSV);
      return withCors(out);
    }
    return withCors(json({ ok: false, error: 'Unknown action' }));
  } catch (err) {
    return withCors(json({ ok: false, error: String(err) }, 500));
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const ua = e.postData && e.postData.type ? e.postData.type : '';
    const ip = getIP(e);

    // Basic validation
    const required = ['name','email','phone','area','party_size','preferred_date'];
    for (const k of required) {
      if (!body[k] || String(body[k]).trim() === '') {
        return withCors(json({ ok: false, error: `Missing field: ${k}` }, 400));
      }
    }

    // Normalize
    const email = String(body.email).trim().toLowerCase();
    const party_size = Math.max(1, parseInt(body.party_size, 10) || 1);
    const preferred_date = String(body.preferred_date).trim(); // YYYY-MM-DD
    const host_meal = (String(body.host_meal || 'none').trim().toLowerCase());
    const normalized_host = ['lunch','dinner'].includes(host_meal) ? host_meal : 'none';

    // Config checks
    const cfg = getConfig();
    // Date closed?
    if (cfg.CLOSED_DATES && cfg.CLOSED_DATES.has(preferred_date)) {
      return reject_403('That date is closed for new signups. Please choose another date.');
    }

    const domain = (email.split('@')[1] || '').toLowerCase();

    // Blocklists FIRST: deny regardless of allowlists
    if (cfg.BLOCKED_EMAILS && cfg.BLOCKED_EMAILS.has(email)) {
      return reject_403('This email is blocked for this signup.');
    }
    if (cfg.BLOCKED_DOMAINS && cfg.BLOCKED_DOMAINS.has(domain)) {
      return reject_403('This email domain is blocked for this signup.');
    }

    // Allowlist checks
    if (cfg.ALLOWED_EMAILS && cfg.ALLOWED_EMAILS.size > 0 && !cfg.ALLOWED_EMAILS.has(email)) {
      return reject_403('This email is not on the allowlist. Contact the coordinators.');
    }
    if ((!cfg.ALLOWED_EMAILS || cfg.ALLOWED_EMAILS.size === 0) && cfg.ALLOWED_DOMAINS && cfg.ALLOWED_DOMAINS.size > 0) {
      if (!cfg.ALLOWED_DOMAINS.has(domain)) {
        return reject_403('Email domain is not allowed for this signup.');
      }
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_SIGNUPS);
    if (!sh) throw new Error(`Missing sheet: ${SHEET_SIGNUPS}`);

    const now = new Date();
    const uuid = body.uuid || Utilities.getUuid();
    const row = [
      now,
      uuid,
      String(body.name).trim(),
      email,
      digitsOnly(body.phone),
      String(body.area).trim(),
      party_size,
      preferred_date,
      normalized_host,
      String(body.notes || '').trim(),
      String(body.user_agent || ua || '') ,
      ip
    ];

    // Check if this is an upsert (same email + date)
    let foundRow = -1;
    if (UPSERT_BY_EMAIL_AND_DATE) {
      const data = sh.getDataRange().getValues();
      const headers = data[0] || [];
      const idxEmail = headers.indexOf('email');
      const idxPref  = headers.indexOf('preferred_date');
      for (let r = 1; r < data.length; r++) {
        const e = String(data[r][idxEmail] || '').toLowerCase();
        const d = String(data[r][idxPref] || '');
        if (e === email && d === preferred_date) {
          foundRow = r + 1; // 1-based
          break;
        }
      }
    }

    // Capacity check (only for NEW rows)
    const cap = cfg.CAPACITY_PER_DATE || DEFAULT_CAPACITY_PER_DATE;
    const counts = countByDate();
    const current = counts[preferred_date] || 0;
    const isNewRow = (foundRow === -1);
    if (isNewRow && current >= cap) {
      return withCors(json({ ok: false, error: 'This date is full. Please pick another date.' }, 409));
    }

    // Upsert / append
    if (foundRow > 0) {
      sh.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }

    return withCors(json({ ok: true, message: 'Registered. Thank you!', uuid, saved_at: new Date() }, 201));
  } catch (err) {
    return withCors(json({ ok: false, error: String(err) }, 500));
  }
}

/** ===== Utilities ===== */

function getAllRows() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_SIGNUPS);
  if (!sh) throw new Error(`Missing sheet: ${SHEET_SIGNUPS}`);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const out = values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => {
      const o = {};
      headers.forEach((h, i) => o[String(h)] = r[i]);
      return o;
    });
  return out;
}

function countByDate() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_SIGNUPS);
  if (!sh) return {};
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return {};
  const headers = values[0];
  const idxPref = headers.indexOf('preferred_date');
  const counts = {};
  for (let r = 1; r < values.length; r++) {
    const d = String(values[r][idxPref] || '');
    if (!d) continue;
    counts[d] = (counts[d] || 0) + 1; // counts families (rows), not party_size
  }
  return counts;
}

function rowsToCsv(rows) {
  const headers = ['timestamp','uuid','name','email','phone','area','party_size','preferred_date','host_meal','notes','user_agent','ip'];
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => escape(r[h])).join(','));
  }
  return lines.join('\n');
}

function json(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (status) {
    obj.status = status;
  }
  return out;
}

function withCors(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
}

function getConfig() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_CONFIG);
  const cfg = {
    ALLOWED_DOMAINS: new Set(),
    ALLOWED_EMAILS: new Set(),
    BLOCKED_DOMAINS: new Set(),
    BLOCKED_EMAILS: new Set(),
    CLOSED_DATES: new Set(),
    ADMIN_PASSCODE: '',
    CAPACITY_PER_DATE: DEFAULT_CAPACITY_PER_DATE
  };
  if (!sh) return cfg;
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    const k = String(values[r][0] || '').trim().toUpperCase();
    const v = String(values[r][1] || '').trim();
    if (!k) continue;
    if (k === 'ALLOWED_DOMAINS') v.split(';').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(d => cfg.ALLOWED_DOMAINS.add(d));
    if (k === 'ALLOWED_EMAILS') v.split(';').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(d => cfg.ALLOWED_EMAILS.add(d));
    if (k === 'BLOCKED_DOMAINS') v.split(';').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(d => cfg.BLOCKED_DOMAINS.add(d));
    if (k === 'BLOCKED_EMAILS') v.split(';').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(d => cfg.BLOCKED_EMAILS.add(d));
    if (k === 'CLOSED_DATES') v.split(';').map(s=>s.trim()).filter(Boolean).forEach(d => cfg.CLOSED_DATES.add(d));
    if (k === 'ADMIN_PASSCODE') cfg.ADMIN_PASSCODE = v;
    if (k === 'CAPACITY_PER_DATE') {
      const n = parseInt(v,10);
      if (!isNaN(n) && n > 0) cfg.CAPACITY_PER_DATE = n;
    }
  }
  return cfg;
}

function guardAdmin(provided) {
  const pass = (getConfig().ADMIN_PASSCODE || '').trim();
  if (!pass) throw new Error('Admin passcode not set in Config sheet.');
  if (String(provided || '').trim() !== pass) throw new Error('Invalid admin passcode.');
}

function digitsOnly(s) {
  return String(s || '').replace(/\D+/g,'');
}

function getIP(e) {
  try {
    return (e && e.parameter && e.parameter['X-Forwarded-For']) || (e && e.parameter && e.parameter['x-forwarded-for']) || '';
  } catch (err) {
    return '';
  }
}

function reject_403(message) {
  return withCors(json({ ok: false, error: message, status: 403 }));
}
