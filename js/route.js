// =========================================================
// REISEROUTE als horizontale Kalender-Timeline
//
// Zeilen (von oben nach unten):
//   1. Tage (Spaltenköpfe)
//   2. Etappen          – z. B. "Bangkok", "Rundreise Süden"
//   3. Abschnitte       – Unterblöcke einer Etappe, z. B. "Krabi"
//   4. Aktivitäten      – pro Tag
//   5. Nächte           – Pfeil von Tag zu Tag mit der Unterkunft
// =========================================================
import { TRIP, DEFAULT_BLOCKS, COLORS } from "./config.js";
import { store, newId } from "./store.js";
import { $, esc, addDays, daysBetween, fmtDay, fmtRange, fmtParts, todayIso } from "./utils.js";
import { openForm } from "./ui.js";

// ---- Daten ----
// blocks:     [{ id, name, from, to, color, parentId }]  parentId = null → Etappe
// activities: [{ id, date, title, time, note, booked }]
// nights:     { "2027-02-28": { stay, booked, note } }   = Nacht vom 28. auf den 1.
let blocks = store.load("blocks", null) ?? DEFAULT_BLOCKS.map((b) => ({ ...b, id: newId(), parentId: null }));
let activities = store.load("activities", []);
let nights = store.load("nights", {});
if (!store.has("blocks")) store.save("blocks", blocks); // Start-Etappen einmal festschreiben (feste IDs)

// Übernimmt Einträge aus der ersten Version der Seite (eine Karte pro Tag)
(function migrateV1() {
  const old = store.load("days", null);
  if (!old || store.has("activities")) return;
  for (const [date, d] of Object.entries(old)) {
    if (d.stay) nights[date] = { stay: d.stay, booked: !!d.stayBooked, note: "" };
    if (d.plans) activities.push({ id: newId(), date, title: d.plans.split("\n")[0].slice(0, 60), time: "", note: d.plans, booked: false });
    if (d.bookings) activities.push({ id: newId(), date, title: "Buchung", time: "", note: d.bookings, booked: true });
  }
  persist();
})();

function persist() {
  store.save("blocks", blocks);
  store.save("activities", activities);
  store.save("nights", nights);
}

function saveAndRender() {
  persist();
  render();
}

// ---- Berechnungen ----
function getRange() {
  let start = TRIP.start, end = TRIP.end;
  for (const b of blocks) {
    if (b.from < start) start = b.from;
    if (b.to > end) end = b.to;
  }
  const days = Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));
  return { start, end, days };
}

const topBlocks = () => blocks.filter((b) => !b.parentId);
const subBlocks = () => blocks.filter((b) => b.parentId && blocks.some((p) => p.id === b.parentId));

// Verteilt überlappende Blöcke auf mehrere Spuren (wie Termine im Kalender)
function assignLanes(items) {
  const laneEnds = [];
  const sorted = [...items].sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to));
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end < it.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.to;
    it._lane = lane;
  }
  return Math.max(1, laneEnds.length);
}

// ---- Darstellung ----
let firstRender = true;

export function render() {
  const { start, end, days } = getRange();
  const tops = topBlocks();
  const subs = subBlocks();
  const L1 = assignLanes(tops);
  const L2 = assignLanes(subs);

  const ROW_TOP = 2, ROW_SUB = ROW_TOP + L1, ROW_ACT = ROW_SUB + L2, ROW_NIGHT = ROW_ACT + 1;
  const ROWS = ROW_NIGHT;
  const col = (iso) => daysBetween(start, iso) + 2; // Spalte 1 = Beschriftung
  const today = todayIso();

  const grid = $("tl-grid");
  grid.style.gridTemplateColumns = `var(--label-w) repeat(${days.length}, var(--day-w))`;
  grid.style.gridTemplateRows = `auto repeat(${L1}, 56px) repeat(${L2}, 50px) minmax(170px, auto) 76px`;

  const html = [];

  // Beschriftungen links (bleiben beim Scrollen stehen)
  html.push(`<div class="tl-corner" style="grid-row:1;grid-column:1"></div>`);
  // Auf dem Handy wird statt des Worts nur ein Symbol gezeigt
  const label = (row, span, text, icon) =>
    html.push(`<div class="tl-label" style="grid-row:${row} / span ${span};grid-column:1" title="${text}">
      <span class="tl-label__text">${text}</span><span class="tl-label__icon" aria-hidden="true">${icon}</span></div>`);
  label(ROW_TOP, L1, "Etappen", "▰");
  label(ROW_SUB, L2, "Abschnitte", "▱");
  label(ROW_ACT, 1, "Aktivitäten", "✦");
  label(ROW_NIGHT, 1, "Nächte", "☾");

  // Tagesspalten (Hintergrund + Kopf)
  days.forEach((iso, i) => {
    const p = fmtParts(iso);
    const cls = `${p.weekend ? " is-weekend" : ""}${iso === today ? " is-today" : ""}`;
    html.push(`<div class="tl-col${cls}" style="grid-column:${i + 2};grid-row:1 / ${ROWS + 1}" data-col="${iso}"></div>`);
    html.push(`<div class="tl-day${cls}" style="grid-column:${i + 2};grid-row:1">
      <span class="tl-day__wd">${p.weekday}</span>
      <span class="tl-day__num">${p.day}</span>
      <span class="tl-day__mon">${p.month}</span>
      <span class="tl-day__no">Tag ${i + 1}</span>
    </div>`);
    // Klickflächen zum Anlegen neuer Blöcke
    html.push(`<button class="tl-slot" style="grid-column:${i + 2};grid-row:${ROW_TOP} / span ${L1}" data-add-block="top" data-date="${iso}" aria-label="Etappe am ${fmtDay(iso)} anlegen">+</button>`);
    html.push(`<button class="tl-slot" style="grid-column:${i + 2};grid-row:${ROW_SUB} / span ${L2}" data-add-block="sub" data-date="${iso}" aria-label="Abschnitt am ${fmtDay(iso)} anlegen">+</button>`);
  });

  // Etappen und Abschnitte
  const blockHtml = (b, row, isSub) => {
    const from = b.from < start ? start : b.from;
    const to = b.to > end ? end : b.to;
    const span = daysBetween(from, to) + 1;
    const parent = isSub ? blocks.find((p) => p.id === b.parentId) : null;
    const color = b.color || parent?.color || COLORS[0].value;
    return `<button class="tl-block${isSub ? " tl-block--sub" : ""}" data-block="${b.id}"
      style="grid-column:${col(from)} / span ${span};grid-row:${row + b._lane};--c:${color}">
      <strong>${esc(b.name)}</strong><span>${fmtRange(b.from, b.to)} · ${daysBetween(b.from, b.to) + 1} ${b.from === b.to ? "Tag" : "Tage"}</span>
    </button>`;
  };
  html.push(`<div class="tl-rowline" style="grid-column:2 / -1;grid-row:${ROW_SUB}"></div>`);
  tops.forEach((b) => html.push(blockHtml(b, ROW_TOP, false)));
  subs.forEach((b) => html.push(blockHtml(b, ROW_SUB, true)));

  // Aktivitäten pro Tag
  days.forEach((iso, i) => {
    const acts = activities
      .filter((a) => a.date === iso)
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    html.push(`<div class="tl-acts" style="grid-column:${i + 2};grid-row:${ROW_ACT}">
      ${acts.map((a) => `<button class="tl-act${a.booked ? " is-booked" : ""}" data-act="${a.id}">
        ${a.time ? `<span class="tl-act__time">${esc(a.time)}</span>` : ""}
        <span class="tl-act__title">${esc(a.title)}</span>
        ${a.booked ? '<span class="tl-act__booked" title="gebucht">✓</span>' : ""}
      </button>`).join("")}
      <button class="tl-add" data-add-act="${iso}">+ Aktivität</button>
    </div>`);
  });

  // Nächte: Pfeil von der Mitte eines Tages zur Mitte des nächsten
  html.push(`<div class="tl-rowline" style="grid-column:2 / -1;grid-row:${ROW_NIGHT}"></div>`);
  days.slice(0, -1).forEach((iso, i) => {
    const n = nights[iso];
    const state = !n ? "is-empty" : n.booked ? "is-booked" : "is-open";
    const text = n ? esc(n.stay) : "Unterkunft eintragen";
    html.push(`<div class="tl-night" style="grid-column:${i + 2} / span 2;grid-row:${ROW_NIGHT}">
      <button class="tl-night__btn ${state}" data-night="${iso}" title="Nacht ${fmtDay(iso)} → ${fmtDay(addDays(iso, 1))}">
        <span class="tl-night__label"><span class="tl-night__moon">☾</span><span class="tl-night__name">${text}</span>${n ? `<span class="tl-night__status">${n.booked ? "gebucht" : "offen"}</span>` : ""}</span>
        <span class="tl-night__arrow"></span>
      </button>
    </div>`);
  });

  grid.innerHTML = html.join("");

  // Zusammenfassung über der Timeline
  const booked = days.slice(0, -1).filter((d) => nights[d]?.booked).length;
  $("route-summary").textContent =
    `${fmtRange(start, end)} · ${days.length} Tage · ${booked} von ${days.length - 1} Nächten gebucht · ${activities.length} Aktivitäten`;

  if (firstRender) {
    firstRender = false;
    requestAnimationFrame(() => scrollToDate(today >= start && today <= end ? today : start, false));
  }
}

// ---- Scrollen ----
const scroller = () => $("tl-scroll");
const dayWidth = () => scroller().querySelector(".tl-day")?.offsetWidth || 160;

function scrollToDate(iso, smooth = true) {
  const colEl = scroller().querySelector(`[data-col="${iso}"]`);
  if (!colEl) return;
  const labelW = scroller().querySelector(".tl-corner")?.offsetWidth || 0;
  scroller().scrollTo({ left: colEl.offsetLeft - labelW, behavior: smooth ? "smooth" : "auto" });
}

// ---- Bearbeiten ----
const colorOptions = COLORS.map((c) => ({ value: c.value, label: c.name }));

function editBlock(block, isNew = false) {
  const hasChildren = blocks.some((b) => b.parentId === block.id);
  const parentOptions = [
    { value: "", label: "– keine (eigene Etappe) –" },
    ...(hasChildren ? [] : topBlocks().filter((b) => b.id !== block.id).map((b) => ({ value: b.id, label: b.name }))),
  ];
  const isSub = !!block.parentId;

  openForm({
    title: isNew ? (isSub ? "Neuer Abschnitt" : "Neue Etappe") : isSub ? "Abschnitt bearbeiten" : "Etappe bearbeiten",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: isSub ? "z. B. Krabi, Koh Lanta" : "z. B. Bangkok" },
      { type: "row", fields: [
        { name: "from", label: "Von", type: "date", required: true },
        { name: "to", label: "Bis (einschließlich)", type: "date", required: true },
      ] },
      { name: "color", label: "Farbe", type: "select", options: colorOptions },
      { name: "parentId", label: "Gehört zu Etappe", type: "select", options: parentOptions,
        hint: hasChildren ? "Diese Etappe hat Abschnitte und bleibt deshalb eine Etappe." : "Mit einer Etappe ausgewählt wird der Block zum Abschnitt." },
    ],
    values: { ...block, parentId: block.parentId || "" },
    onSave: (v) => {
      if (v.to < v.from) [v.from, v.to] = [v.to, v.from];
      const data = { name: v.name, from: v.from, to: v.to, color: v.color, parentId: v.parentId || null };
      if (isNew) blocks.push({ id: newId(), ...data });
      else Object.assign(blocks.find((b) => b.id === block.id), data);
      saveAndRender();
    },
    onDelete: isNew ? null : () => {
      // Abschnitte einer gelöschten Etappe werden mit gelöscht
      blocks = blocks.filter((b) => b.id !== block.id && b.parentId !== block.id);
      saveAndRender();
    },
  });
}

function newBlock(level, date) {
  if (level === "sub") {
    const parent = topBlocks().find((b) => b.from <= date && date <= b.to);
    editBlock({ name: "", from: date, to: date, color: parent?.color || COLORS[0].value, parentId: parent?.id || "" }, true);
  } else {
    editBlock({ name: "", from: date, to: date, color: COLORS[0].value, parentId: null }, true);
  }
}

function editActivity(act, isNew = false) {
  const { start, end } = getRange();
  openForm({
    title: isNew ? `Aktivität am ${fmtDay(act.date)}` : "Aktivität bearbeiten",
    fields: [
      { name: "title", label: "Was?", type: "text", required: true, placeholder: "z. B. Kochkurs, Bootstour, Tempel" },
      { type: "row", fields: [
        { name: "date", label: "Tag", type: "date", required: true, min: start, max: end },
        { name: "time", label: "Uhrzeit (optional)", type: "time" },
      ] },
      { name: "note", label: "Notizen", type: "textarea", placeholder: "Treffpunkt, Preis, Link, …" },
      { name: "booked", label: "Schon gebucht / reserviert", type: "checkbox" },
    ],
    values: act,
    onSave: (v) => {
      if (isNew) activities.push({ id: newId(), ...v });
      else Object.assign(activities.find((a) => a.id === act.id), v);
      saveAndRender();
    },
    onDelete: isNew ? null : () => {
      activities = activities.filter((a) => a.id !== act.id);
      saveAndRender();
    },
  });
}

function editNight(date) {
  const n = nights[date];
  // Neue Nacht: Unterkunft der Vornacht vorschlagen (spart Tipparbeit bei mehreren Nächten)
  const prev = nights[addDays(date, -1)];
  openForm({
    title: `Nacht ${fmtDay(date)} → ${fmtDay(addDays(date, 1))}`,
    fields: [
      { name: "stay", label: "Unterkunft", type: "text", required: true, placeholder: "Hotel, Hostel, Airbnb, Nachtzug …",
        hint: !n && prev ? "Vorschlag aus der Nacht davor" : "" },
      { name: "note", label: "Notizen", type: "textarea", placeholder: "Adresse, Link, Check-in-Zeit, Preis …" },
      { name: "booked", label: "Gebucht", type: "checkbox" },
    ],
    values: n || (prev ? { ...prev } : {}),
    onSave: (v) => {
      nights[date] = v;
      saveAndRender();
    },
    onDelete: n ? () => {
      delete nights[date];
      saveAndRender();
    } : null,
  });
}

export function init() {
  const grid = $("tl-grid");

  grid.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.block) editBlock(blocks.find((b) => b.id === t.dataset.block));
    else if (t.dataset.addBlock) newBlock(t.dataset.addBlock, t.dataset.date);
    else if (t.dataset.act) editActivity(activities.find((a) => a.id === t.dataset.act));
    else if (t.dataset.addAct) editActivity({ date: t.dataset.addAct, title: "", time: "", note: "", booked: false }, true);
    else if (t.dataset.night) editNight(t.dataset.night);
  });

  // Mausrad scrollt die Timeline seitwärts (Trackpads scrollen ohnehin seitwärts)
  scroller().addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.shiftKey) return;
    const el = scroller();
    const max = el.scrollWidth - el.clientWidth;
    if ((e.deltaY < 0 && el.scrollLeft > 0) || (e.deltaY > 0 && el.scrollLeft < max - 1)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  $("tl-prev").addEventListener("click", () => scroller().scrollBy({ left: -dayWidth() * 3, behavior: "smooth" }));
  $("tl-next").addEventListener("click", () => scroller().scrollBy({ left: dayWidth() * 3, behavior: "smooth" }));
  $("tl-today").addEventListener("click", () => {
    const { start, end } = getRange();
    const t = todayIso();
    scrollToDate(t >= start && t <= end ? t : start);
  });
  $("tl-add-top").addEventListener("click", () => newBlock("top", getRange().start));
  $("tl-add-sub").addEventListener("click", () => {
    const south = topBlocks().find((b) => /süd/i.test(b.name)) || topBlocks()[0];
    newBlock("sub", south ? south.from : getRange().start);
  });
}
