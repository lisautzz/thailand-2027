// =========================================================
// EINSTIEGSPUNKT der Seite
// Lädt alle Module und schaltet zwischen den Seiten um.
// Die eigentliche Logik steckt im Ordner js/:
//   config.js   – Reisedaten, Personen, Farben (HIER ANPASSEN)
//   store.js    – Speichern (später Supabase)
//   start.js    – Countdown + Karten-Animation
//   route.js    – Reiseroute (Timeline)
//   places.js   – Karte für die Südreise
//   todos.js    – To-do-Liste
//   expenses.js – Ausgaben
// =========================================================
import { $ } from "./js/utils.js";
import * as start from "./js/start.js";
import * as route from "./js/route.js";
import * as places from "./js/places.js";
import * as todos from "./js/todos.js";
import * as expenses from "./js/expenses.js";

const VIEWS = {
  start: { onShow: start.startAnimation, onHide: start.stopAnimation },
  route: { onShow: route.render },
  karte: { onShow: places.show },
  todo: { onShow: todos.render },
  ausgaben: { onShow: expenses.render },
};

let current = null;

function showView() {
  const wanted = location.hash.slice(1);
  const view = wanted in VIEWS ? wanted : "start";

  if (current && current !== view) VIEWS[current].onHide?.();
  for (const v of Object.keys(VIEWS)) $("view-" + v).hidden = v !== view;
  $("topnav").hidden = view === "start";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === view));

  current = view;
  VIEWS[view].onShow?.();
  window.scrollTo(0, 0);
}

// Einmalige Einrichtung
start.initCountdown();
start.buildMap();
route.init();
places.init();
todos.init();
expenses.init();

window.addEventListener("hashchange", showView);
document.addEventListener("visibilitychange", () => {
  if (current !== "start") return;
  if (document.hidden) start.stopAnimation();
  else start.startAnimation();
});

showView();
