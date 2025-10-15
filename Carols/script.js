// ATC Christmas Carols — Signup Page JS
// v1.0 (2025-10-15)

const ENDPOINT = "https://script.google.com/macros/s/AKfycbxJGu3a0dT4iWj71diD7DyCrVCcrkzTmyy0xrwqbPwVXLUybXYbjUUuURwDGazsxfFWdg/exec"; // <-- replace after deploying
const AVAILABLE_DATES = [
  { iso: "2025-12-06", label: "Sat, Dec 6" },
  { iso: "2025-12-13", label: "Sat, Dec 13" },
  { iso: "2025-12-20", label: "Sat, Dec 20" }
];

function $(sel) { return document.querySelector(sel); }

function populateDates() {
  const sel = $("#preferred_date");
  sel.innerHTML = '<option value="">Select a date…</option>';
  for (const d of AVAILABLE_DATES) {
    const o = document.createElement("option");
    o.value = d.iso;
    o.textContent = d.label;
    sel.appendChild(o);
  }
}

async function submitForm(ev) {
  ev.preventDefault();
  const payload = {
    name: $("#name").value.trim(),
    email: $("#email").value.trim(),
    phone: $("#phone").value.trim(),
    area: $("#area").value.trim(),
    party_size: $("#party_size").value.trim(),
    preferred_date: $("#preferred_date").value.trim(),
    notes: $("#notes").value.trim(),
    user_agent: navigator.userAgent
  };

  const btn = $("#submitBtn");
  const msg = $("#message");
  btn.disabled = true; msg.textContent = "Submitting…";

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(()=>({ ok:false, error:"Invalid JSON" }));
    if (data.ok) {
      msg.textContent = "Thank you! Your signup is recorded.";
      $("#signupForm").reset();
    } else {
      msg.textContent = data.error || "Something went wrong.";
    }
  } catch (err) {
    msg.textContent = "Network error. Please try again.";
  } finally {
    btn.disabled = false;
  }
}

function formatPhone() {
  const input = $("#phone");
  input.value = input.value.replace(/\D+/g,'').slice(0,15);
}

document.addEventListener("DOMContentLoaded", () => {
  populateDates();
  $("#signupForm").addEventListener("submit", submitForm);
  $("#phone").addEventListener("input", formatPhone);
});
