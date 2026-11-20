// =========================================================
// HINWEIS AUF NEUE ÄNDERUNGEN DER ANDEREN PERSON
//
// Jede gespeicherte Liste hat in Supabase "updated_by" (wer) und
// "updated_at" (Zeitstempel der letzten Änderung).
// Pro Person merken wir uns, welchen Stand sie zuletzt gesehen hat:
//   Zeile "seen:<e-mail>" = { todos: "<updated_at>", nights: "...", ... }
// Ungesehen = zuletzt von jemand ANDEREM geändert UND der Stand
// unterscheidet sich vom zuletzt gesehenen.
// Weil wir Zeitstempel nur vergleichen (nicht rechnen), spielen falsch
// gehende Uhren auf den Geräten keine Rolle.
// =========================================================
import { store } from "./store.js";
import { esc } from "./utils.js";

// Welche Listen gehören zu welcher Seite?
export const SECTIONS = [
  { view: "route", keys: ["blocks", "activities", "nights"], text: "an der Reiseroute" },
  { view: "todo", keys: ["todos"], text: "an den To-dos" },
  { view: "ausgaben", keys: ["expenses"], text: "an den Ausgaben" },
  { view: "karte", keys: ["places"], text: "an der Karte" },
];

let seen = null;
let me = "";
export let seenKey = "";

const isActive = () => store.mode === "cloud" && seen;

export function init() {
  if (store.mode !== "cloud") return;
  me = store.userEmail.toLowerCase();
  seenKey = "seen:" + me;
  seen = store.load(seenKey, null);
  if (!seen) {
    // Allererster Start mit dieser Funktion: alles Bisherige gilt als gesehen
    seen = {};
    for (const s of SECTIONS) for (const k of s.keys) seen[k] = store.meta(k)?.updated_at || null;
    store.save(seenKey, seen);
  }
}

// Wenn ich auf einem anderen Gerät etwas angeschaut habe
export function reloadSeen() {
  if (store.mode !== "cloud") return;
  seen = store.load(seenKey, seen);
}

function isUnseen(key) {
  const m = store.meta(key);
  if (!m || !m.updated_by) return false;
  return m.updated_by.toLowerCase() !== me && m.updated_at !== seen[key];
}

export function unseenSections() {
  if (!isActive()) return [];
  return SECTIONS.filter((s) => s.keys.some(isUnseen));
}

// Seite wurde angeschaut → aktuellen Stand als gesehen merken
export function markSeen(view) {
  if (!isActive()) return;
  const section = SECTIONS.find((s) => s.view === view);
  if (!section) return;
  let changed = false;
  for (const k of section.keys) {
    const at = store.meta(k)?.updated_at || null;
    if (at && seen[k] !== at) {
      seen[k] = at;
      changed = true;
    }
  }
  if (changed) store.save(seenKey, seen);
}

// Anzeige: Hinweis oben rechts auf der Startseite + Punkt in der Navigation
export function render() {
  const list = unseenSections();
  const box = document.getElementById("news");
  box.hidden = !list.length;
  box.innerHTML = list.length
    ? `<span class="news__icon" aria-hidden="true">!</span>
       <div class="news__items">${list.map((s) =>
         `<a class="news__item" href="#${s.view}">! Es wurden Änderungen ${esc(s.text)} gemacht !</a>`).join("")}</div>`
    : "";
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("has-news", list.some((s) => s.view === a.dataset.nav)));
}
