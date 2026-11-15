// =========================================================
// HILFSFUNKTIONEN
// =========================================================

export const $ = (id) => document.getElementById(id);

// Text sicher in HTML einsetzen (verhindert, dass Eingaben Code ausführen)
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const pad = (n) => String(n).padStart(2, "0");

// ---- Datum ----
// Daten werden als Text "YYYY-MM-DD" gespeichert und in UTC gerechnet,
// damit Sommerzeit-Umstellungen keine Tage verschieben.
const utc = (iso) => new Date(iso + "T00:00:00Z");

export const addDays = (iso, n) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

// Heutiges Datum in der Zeitzone des Geräts
export const todayIso = () => new Date().toLocaleDateString("sv-SE");

const fmt = (iso, opts) => utc(iso).toLocaleDateString("de-DE", { timeZone: "UTC", ...opts });
export const fmtDay = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
export const fmtShort = (iso) => fmt(iso, { day: "numeric", month: "short" });
export const fmtParts = (iso) => ({
  weekday: fmt(iso, { weekday: "short" }).replace(".", ""),
  day: fmt(iso, { day: "numeric" }).replace(".", ""),
  month: fmt(iso, { month: "short" }),
  weekend: [0, 6].includes(utc(iso).getUTCDay()),
});

export const fmtRange = (from, to) => (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`);

// ---- Geld ----
const euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const euro = (n) => euroFmt.format(n || 0);
