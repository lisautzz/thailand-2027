// =========================================================
// KARTE: Orte für die Rundreise im Süden sammeln
// Kartenbibliothek: Leaflet (leafletjs.com), Karte von OpenStreetMap,
// Ortssuche über Nominatim (OpenStreetMap). Alles kostenlos.
//
// places: [{ id, name, lat, lon, description, interested: ["Lisa", "Michel"] }]
// =========================================================
import { PEOPLE, MAP_VIEW } from "./config.js";
import { store, newId } from "./store.js";
import { $, esc } from "./utils.js";
import { openForm } from "./ui.js";

let places = store.load("places", []);
let map, markers = {};
let filter = "alle";

function save() {
  store.save("places", places);
  render();
}

// Farbe der Stecknadel: wer will hin?
function pinClass(p) {
  const i = p.interested || [];
  if (i.length >= PEOPLE.length) return "pin--both";
  if (i.includes(PEOPLE[0])) return "pin--a";
  if (i.includes(PEOPLE[1])) return "pin--b";
  return "pin--none";
}

function visible(p) {
  if (filter === "alle") return true;
  if (filter === "beide") return (p.interested || []).length >= PEOPLE.length;
  return (p.interested || []).includes(filter);
}

export function render() {
  if (!map) return;

  // Marker neu setzen
  Object.values(markers).forEach((m) => m.remove());
  markers = {};
  for (const p of places.filter(visible)) {
    const icon = L.divIcon({ className: "pin-wrap", html: `<span class="pin ${pinClass(p)}"></span>`, iconSize: [26, 26], iconAnchor: [13, 26] });
    markers[p.id] = L.marker([p.lat, p.lon], { icon, title: p.name })
      .addTo(map)
      .bindTooltip(esc(p.name), { direction: "top", offset: [0, -24] })
      .on("click", () => edit(p));
  }

  // Liste unter der Karte (Orte, die beide wollen, zuerst)
  const sorted = places.filter(visible).sort((a, b) => (b.interested?.length || 0) - (a.interested?.length || 0) || a.name.localeCompare(b.name));
  $("places-list").innerHTML = sorted.length
    ? sorted.map((p) => `
      <li class="place">
        <span class="pin pin--static ${pinClass(p)}"></span>
        <button class="place__main" data-fly="${p.id}">
          <span class="place__name">${esc(p.name)}</span>
          ${p.description ? `<span class="place__desc">${esc(p.description)}</span>` : ""}
          <span class="place__who">${(p.interested || []).length ? "Will hin: " + p.interested.map(esc).join(" & ") : "Noch niemand eingetragen"}</span>
        </button>
        <button class="btn btn--small btn--ghost-dark" data-edit-place="${p.id}">Bearbeiten</button>
      </li>`).join("")
    : '<li class="empty">Noch keine Orte. Such oben nach einem Ort oder tippe auf die Karte.</li>';

  const both = places.filter((p) => (p.interested || []).length >= PEOPLE.length).length;
  $("places-count").textContent = `${places.length} Orte · ${both} wollen beide`;
}

function edit(p, isNew = false) {
  openForm({
    title: isNew ? "Ort hinzufügen" : p.name,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "z. B. Koh Lanta" },
      { name: "description", label: "Beschreibung", type: "textarea", placeholder: "Warum wollen wir hin? Was gibt es dort?" },
      { name: "interested", label: "Wer will hin?", type: "checks", options: PEOPLE },
    ],
    values: p,
    onSave: (v) => {
      if (isNew) places.push({ ...p, ...v, id: newId() });
      else Object.assign(places.find((x) => x.id === p.id), v);
      save();
    },
    onDelete: isNew ? null : () => {
      places = places.filter((x) => x.id !== p.id);
      save();
    },
  });
}

// ---- Ortssuche (Nominatim) ----
async function search(query) {
  const box = $("place-results");
  box.hidden = false;
  box.innerHTML = '<li class="results__msg">Suche …</li>';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=th&accept-language=de&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const results = await res.json();
    box.innerHTML = results.length
      ? results.map((r, i) => `<li><button data-result="${i}"><strong>${esc(r.name || r.display_name.split(",")[0])}</strong>
          <span>${esc(r.display_name)}</span></button></li>`).join("")
      : '<li class="results__msg">Nichts gefunden. Tipp: Englische Schreibweise probieren oder direkt auf die Karte tippen.</li>';
    box.onclick = (e) => {
      const btn = e.target.closest("[data-result]");
      if (!btn) return;
      const r = results[btn.dataset.result];
      box.hidden = true;
      $("place-query").value = "";
      map.flyTo([+r.lat, +r.lon], 10);
      edit({ name: r.name || r.display_name.split(",")[0], lat: +r.lat, lon: +r.lon, description: "", interested: [] }, true);
    };
  } catch {
    box.innerHTML = '<li class="results__msg">Suche gerade nicht möglich. Du kannst den Ort direkt auf der Karte antippen.</li>';
  }
}

// Wird beim ersten Öffnen der Seite aufgerufen (Leaflet braucht einen sichtbaren Container)
export function show() {
  if (!window.L) {
    $("places-map").innerHTML = '<p class="empty">Die Karte konnte nicht geladen werden. Bist du online?</p>';
    return;
  }
  if (!map) {
    map = L.map("places-map", { zoomControl: true }).setView([MAP_VIEW.lat, MAP_VIEW.lon], MAP_VIEW.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // Tippen auf die Karte → neuen Ort an dieser Stelle anlegen
    map.on("click", (e) => edit({ name: "", lat: e.latlng.lat, lon: e.latlng.lng, description: "", interested: [] }, true));
    render();
    if (places.length) map.fitBounds(places.map((p) => [p.lat, p.lon]), { padding: [40, 40], maxZoom: 9 });
  }
  setTimeout(() => map.invalidateSize(), 0);
}

export function init() {
  $("place-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("place-query").value.trim();
    if (q) search(q);
  });

  $("places-filter").innerHTML = ["alle", ...PEOPLE, "beide"]
    .map((f) => `<button class="seg${f === filter ? " is-active" : ""}" data-filter="${esc(f)}">${f === "alle" ? "Alle" : f === "beide" ? "Beide" : esc(f)}</button>`)
    .join("");
  $("places-filter").addEventListener("click", (e) => {
    const f = e.target.dataset.filter;
    if (!f) return;
    filter = f;
    $("places-filter").querySelectorAll(".seg").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === f));
    render();
  });

  $("places-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const p = places.find((x) => x.id === (btn.dataset.fly || btn.dataset.editPlace));
    if (!p) return;
    if (btn.dataset.fly) {
      map.flyTo([p.lat, p.lon], 11);
      markers[p.id]?.openTooltip();
      $("places-map").scrollIntoView({ behavior: "smooth", block: "center" });
    } else edit(p);
  });
}
