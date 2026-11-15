// =========================================================
// EINSTIEGSPUNKT der Seite
// Lädt alle Module und schaltet zwischen den Seiten um.
// Die eigentliche Logik steckt im Ordner js/:
//   config.js          – Reisedaten, Personen, Farben (HIER ANPASSEN)
//   supabase-config.js – Zugangsdaten für die Datenbank
//   store.js           – Speichern (Supabase oder lokal) + Login
//   start.js           – Countdown + Karten-Animation
//   route.js           – Reiseroute (Timeline)
//   places.js          – Karte für die Südreise
//   todos.js           – To-do-Liste
//   expenses.js        – Ausgaben
// =========================================================
import { $ } from "./js/utils.js";
import { store } from "./js/store.js";
import { toast } from "./js/ui.js";
import * as start from "./js/start.js";
import * as route from "./js/route.js";
import * as places from "./js/places.js";
import * as todos from "./js/todos.js";
import * as expenses from "./js/expenses.js";

const VIEWS = {
  start: { onShow: start.startAnimation, onHide: start.stopAnimation, public: true },
  route: { onShow: route.render },
  karte: { onShow: places.show },
  todo: { onShow: todos.render },
  ausgaben: { onShow: expenses.render },
};

// Welche gespeicherte Liste gehört zu welcher Seite?
const MODULE_FOR_KEY = {
  blocks: { mod: route, view: "route" },
  activities: { mod: route, view: "route" },
  nights: { mod: route, view: "route" },
  todos: { mod: todos, view: "todo" },
  expenses: { mod: expenses, view: "ausgaben" },
  places: { mod: places, view: "karte" },
};

let current = null;

function showView() {
  const wanted = location.hash.slice(1);
  let view = wanted in VIEWS ? wanted : "start";

  // Ohne Login nur die Startseite zeigen
  const locked = store.mode === "login" && !VIEWS[view].public;

  if (current && current !== view) VIEWS[current].onHide?.();
  for (const v of Object.keys(VIEWS)) $("view-" + v).hidden = locked || v !== view;
  $("view-login").hidden = !locked;
  $("topnav").hidden = view === "start";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === view));

  current = view;
  if (!locked) VIEWS[view].onShow?.();
  window.scrollTo(0, 0);
}

// ---------- Login-Ansicht ----------
function initLogin() {
  if (store.loginError) $("login-msg").textContent = store.loginError;

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("login-email").value.trim();
    const btn = $("login-form").querySelector("button");
    btn.disabled = true;
    $("login-msg").textContent = "Einen Moment …";
    const error = await store.sendLoginLink(email);
    btn.disabled = false;
    $("login-msg").textContent = error
      ? "Das hat nicht geklappt. Ist die Adresse eingeladen? (" + error.message + ")"
      : "Schau in dein Postfach und klick auf den Link in der E-Mail. Du landest dann eingeloggt wieder hier.";
  });
}

// ---------- Status in der Navigation ----------
function initStatus() {
  const status = $("sync-status");
  if (store.mode === "cloud") {
    status.textContent = "● Synchron";
    status.title = "Eingeloggt als " + store.userEmail + " – Änderungen werden für euch beide gespeichert.";
    status.className = "sync sync--cloud";
    $("logout").hidden = false;
    $("logout").addEventListener("click", () => store.signOut());
  } else if (store.mode === "local") {
    status.textContent = "● Nur lokal";
    status.title = "Supabase ist noch nicht eingerichtet – Daten liegen nur in diesem Browser.";
    status.className = "sync sync--local";
  } else {
    status.textContent = "";
  }
}

// ---------- Start ----------
async function boot() {
  // Startseite sofort anzeigen (braucht keine Daten)
  start.initCountdown();
  start.buildMap();
  if (!location.hash || location.hash === "#start") start.startAnimation();

  await store.init();

  for (const mod of [route, places, todos, expenses]) {
    mod.load();
    mod.init();
  }
  initLogin();
  initStatus();

  // Änderungen vom anderen Gerät: Daten neu laden, offene Seite neu zeichnen
  store.onRemoteChange((key) => {
    const target = MODULE_FOR_KEY[key];
    if (!target) return;
    target.mod.load();
    if (current === target.view) VIEWS[current].onShow?.();
  });
  store.onError(toast);

  window.addEventListener("hashchange", showView);
  document.addEventListener("visibilitychange", () => {
    if (current !== "start") return;
    if (document.hidden) start.stopAnimation();
    else start.startAnimation();
  });

  showView();
}

boot();
