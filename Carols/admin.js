// ATC Christmas Carols — Admin Dashboard JS
// v1.0 (2025-10-15)

const ENDPOINT = "https://script.google.com/macros/s/AKfycbxJGu3a0dT4iWj71diD7DyCrVCcrkzTmyy0xrwqbPwVXLUybXYbjUUuURwDGazsxfFWdg/exec"; // <-- replace after deploying
const AVAILABLE_DATES = [
  { iso: "2025-12-06", label: "Sat, Dec 6" },
  { iso: "2025-12-13", label: "Sat, Dec 13" },
  { iso: "2025-12-20", label: "Sat, Dec 20" }
];

function $(sel){ return document.querySelector(sel); }
function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => (e[k] = v));
  children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function populateAdminDates() {
  const sel = $("#filter_date");
  sel.innerHTML = '<option value="">All dates</option>';
  for (const d of AVAILABLE_DATES) {
    const o = document.createElement("option");
    o.value = d.iso; o.textContent = d.label;
    sel.appendChild(o);
  }
}

async function ping() {
  const msg = $("#status");
  msg.textContent = "Pinging…";
  try {
    const url = `${ENDPOINT}?action=ping`;
    const res = await fetch(url);
    const data = await res.json();
    msg.textContent = data.ok ? `Online (v${data.version})` : "Error";
  } catch {
    msg.textContent = "Offline";
  }
}

async function loadRows() {
  const passcode = $("#passcode").value.trim();
  const date = $("#filter_date").value;
  if (!passcode) { alert("Enter passcode"); return; }

  const url = new URL(ENDPOINT);
  url.searchParams.set("action", "list");
  url.searchParams.set("passcode", passcode);
  if (date) url.searchParams.set("date", date);

  $("#loadBtn").disabled = true;
  $("#exportBtn").disabled = true;
  $("#count").textContent = "Loading…";
  $("#tbody").innerHTML = "";

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed");
    $("#count").textContent = `${data.count} record(s)`;
    renderTable(data.rows || []);
    $("#exportBtn").disabled = false;
  } catch (e) {
    $("#count").textContent = "Error";
    alert(e.message);
  } finally {
    $("#loadBtn").disabled = false;
  }
}

function renderTable(rows) {
  const tb = $("#tbody");
  tb.innerHTML = "";
  const sorted = rows.slice().sort((a,b)=> String(a.preferred_date).localeCompare(String(b.preferred_date)) || String(a.name).localeCompare(String(b.name)));
  for (const r of sorted) {
    const tr = el("tr", {}, [
      el("td", {}, [String(r.preferred_date||'')]),
      el("td", {}, [String(r.name||'')]),
      el("td", {}, [String(r.email||'')]),
      el("td", {}, [String(r.phone||'')]),
      el("td", {}, [String(r.area||'')]),
      el("td", {}, [String(r.party_size||'')]),
      el("td", {}, [String(r.notes||'')]),
      el("td", {}, [String(r.timestamp||'')]),
    ]);
    tb.appendChild(tr);
  }
}

function exportCsv() {
  const passcode = $("#passcode").value.trim();
  if (!passcode) { alert("Enter passcode"); return; }
  const url = new URL(ENDPOINT);
  url.searchParams.set("action", "export");
  url.searchParams.set("passcode", passcode);
  window.open(url.toString(), "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  populateAdminDates();
  $("#pingBtn").addEventListener("click", ping);
  $("#loadBtn").addEventListener("click", loadRows);
  $("#exportBtn").addEventListener("click", exportCsv);
  ping();
});
