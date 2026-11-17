// =========================================================
// STARTSEITE: Countdown (Abflugtafel) + Karten-Animation
// =========================================================
import { TRIP } from "./config.js";
import { $, pad, todayIso, daysBetween } from "./utils.js";

// ---------------------------------------------------------
// 1) COUNTDOWN im Stil einer Flughafen-Anzeigetafel
// ---------------------------------------------------------
const departure = new Date(TRIP.departure);
const tripLength = daysBetween(TRIP.start, TRIP.end) + 1;
let countdownTimer;

// Schreibt eine Zahl als einzelne "Klappen". Nur geänderte Ziffern klappen um.
function setDigits(el, text) {
  if (el.children.length !== text.length) {
    el.innerHTML = [...text].map((c) => `<span class="flap">${c}</span>`).join("");
    return;
  }
  [...text].forEach((c, i) => {
    const flap = el.children[i];
    if (flap.textContent === c) return;
    flap.textContent = c;
    flap.classList.remove("is-flipping");
    void flap.offsetWidth; // Animation neu starten
    flap.classList.add("is-flipping");
  });
}

function updateCountdown() {
  const diff = departure - new Date();
  const today = todayIso();

  if (diff > 0) {
    const s = Math.floor(diff / 1000);
    setDigits($("cd-days"), String(Math.floor(s / 86400)).padStart(2, "0"));
    setDigits($("cd-hours"), pad(Math.floor((s % 86400) / 3600)));
    setDigits($("cd-minutes"), pad(Math.floor((s % 3600) / 60)));
    setDigits($("cd-seconds"), pad(s % 60));
  } else if (today <= TRIP.end) {
    $("board-status").textContent = "Unterwegs";
    $("board-units").innerHTML = `<div class="board__unit board__unit--wide">
      <div class="board__digits"><span class="flap flap--text">Tag ${daysBetween(TRIP.start, today) + 1} / ${tripLength}</span></div></div>`;
    clearInterval(countdownTimer);
  } else {
    $("board-status").textContent = "Gelandet";
    $("board-units").hidden = true;
    clearInterval(countdownTimer);
  }
}

export function initCountdown() {
  $("trip-subtitle").textContent = TRIP.subtitle;
  $("board-dest").textContent = TRIP.destinationLabel;
  $("board-when").textContent =
    departure.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " +
    departure.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  $("departure-text").textContent = `${tripLength} Tage · Bangkok · Rundreise im Süden · Singapur`;
  countdownTimer = setInterval(updateCountdown, 1000);
  updateCountdown();
}

// ---------------------------------------------------------
// 2) KARTEN-ANIMATION
// Koordinaten sind Pixel im SVG (600 × 1097), berechnet aus echten
// Längen-/Breitengraden (Mercator-Projektion).
// ---------------------------------------------------------
const MAP = {
  w: 600, h: 1097,
  entry: [-60, 60],
  bangkok: [250, 412],
  south: [170, 701],
  loop: [[170, 701], [144, 711], [152, 659], [192, 648], [205, 727]],
  singapore: [416, 1039],
  exit: [-80, 1000],
};

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

function arc(a, b, bend) {
  const [x1, y1] = a, [x2, y2] = b;
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend;
  return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
}

function loopPath(pts) {
  const n = pts.length;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const SEGMENTS = [
  { d: arc(MAP.entry, MAP.bangkok, 0.18),   mode: "fly",   dur: 2600, stop: "bangkok",   pause: 1800 },
  { d: arc(MAP.bangkok, MAP.south, -0.25),  mode: "fly",   dur: 2200, stop: "south",     pause: 600 },
  { d: loopPath(MAP.loop),                  mode: "drive", dur: 4200, stop: null,        pause: 1200 },
  { d: arc(MAP.south, MAP.singapore, 0.22), mode: "fly",   dur: 2600, stop: "singapore", pause: 1800 },
  { d: arc(MAP.singapore, MAP.exit, 0.2),   mode: "fly",   dur: 2600, stop: null,        pause: 800 },
];

let routeSvg, routeGroup, plane, car;
const stops = {};

export function buildMap() {
  routeSvg = $("route-map");

  // Weiche Ränder, damit man keine harte Bildkante sieht
  const defs = svgEl("defs");
  defs.innerHTML = `
    <linearGradient id="fade-x" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000"/><stop offset="0.12" stop-color="#fff"/>
      <stop offset="0.88" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="fade-y" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#000"/><stop offset="0.08" stop-color="#fff"/>
      <stop offset="0.95" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="mask-x"><rect width="${MAP.w}" height="${MAP.h}" fill="url(#fade-x)"/></mask>
    <mask id="mask-y"><rect width="${MAP.w}" height="${MAP.h}" fill="url(#fade-y)"/></mask>`;
  routeSvg.append(defs);
  const mapGroup = svgEl("g", { mask: "url(#mask-x)" });
  mapGroup.append(svgEl("image", { href: "assets/thailand-map.svg", x: 0, y: 0, width: MAP.w, height: MAP.h, mask: "url(#mask-y)" }));
  routeSvg.append(mapGroup);

  // Handy: Karte unten ausrichten (Text steht oben). Desktop: mittig.
  const desktop = matchMedia("(min-width: 900px)");
  const align = () => routeSvg.setAttribute("preserveAspectRatio", desktop.matches ? "xMidYMid meet" : "xMidYMax meet");
  align();
  desktop.addEventListener("change", align);

  routeGroup = svgEl("g", { class: "route-group" });
  routeSvg.append(routeGroup);

  for (const seg of SEGMENTS) {
    routeGroup.append(svgEl("path", { d: seg.d, class: "route-line--bg" }));
    seg.el = svgEl("path", { d: seg.d, class: "route-line" + (seg.mode === "drive" ? " route-line--drive" : "") });
    routeGroup.append(seg.el);
    seg.len = seg.el.getTotalLength();
    seg.el.style.strokeDasharray = seg.len;
    seg.el.style.strokeDashoffset = seg.len;
  }

  const makeStop = (id, [x, y], lines, anchor = "start", dx = 18) => {
    const g = svgEl("g", { class: "stop" });
    g.append(svgEl("circle", { class: "stop__pulse", cx: x, cy: y, r: 8 }));
    g.append(svgEl("circle", { class: "stop__dot", cx: x, cy: y, r: 6 }));
    const tx = x + (anchor === "end" ? -dx : dx);
    const text = svgEl("text", { x: tx, y: y + 7, "text-anchor": anchor });
    lines.forEach(([main, extra], i) => {
      const t = svgEl("tspan", { x: tx, dy: i === 0 ? 0 : 26 });
      t.textContent = main;
      if (extra) {
        const e = svgEl("tspan", { class: "stop__days" });
        e.textContent = extra;
        t.append(e);
      }
      text.append(t);
    });
    g.append(text);
    routeGroup.append(g);
    stops[id] = g;
  };
  makeStop("bangkok", MAP.bangkok, [["Bangkok", " · 3 Tage"]]);
  makeStop("south", MAP.south, [["Süden", ""], ["", "10 Tage Rundreise"]], "start", 50);
  makeStop("singapore", MAP.singapore, [["Singapur", " · 3 Tage"]], "end");

  // Airbus A380 von oben (Nase zeigt nach rechts): Rumpf, gepfeilte Flügel,
  // 4 Triebwerke, Höhenleitwerk. Einheiten ≈ Meter / 2.
  plane = svgEl("g", { class: "plane", opacity: 0 });
  plane.innerHTML = `
    <path d="M5.5 2.6L-8.5 19.2-10.6 19.2-7.4 9.8-6.6 2.6Z"/>
    <path d="M5.5 -2.6L-8.5 -19.2-10.6 -19.2-7.4 -9.8-6.6 -2.6Z"/>
    <path d="M-11 2.2L-16 8.4-17.6 8.4-16.4 2.2Z"/>
    <path d="M-11 -2.2L-16 -8.4-17.6 -8.4-16.4 -2.2Z"/>
    <rect x="-1.2" y="5.7" width="5" height="2" rx="1"/>
    <rect x="-1.2" y="-7.7" width="5" height="2" rx="1"/>
    <rect x="-5.6" y="11.6" width="4.8" height="1.9" rx="0.95"/>
    <rect x="-5.6" y="-13.5" width="4.8" height="1.9" rx="0.95"/>
    <path d="M18.4 0C18.4-2.2 16.6-3 13.4-3L-11.5-3C-14.8-2.8-17-1.4-18.4 0-17 1.4-14.8 2.8-11.5 3L13.4 3C16.6 3 18.4 2.2 18.4 0Z"/>`;
  car = svgEl("circle", { r: 7, fill: "#5eead4", opacity: 0 });
  routeGroup.append(plane, car);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function animateSegment(seg, token) {
  return new Promise((resolve) => {
    const start = performance.now();
    const mover = seg.mode === "fly" ? plane : car;
    plane.setAttribute("opacity", seg.mode === "fly" ? 1 : 0);
    car.setAttribute("opacity", seg.mode === "drive" ? 1 : 0);

    function frame(now) {
      if (token.cancelled) return resolve();
      const t = Math.min(1, (now - start) / seg.dur);
      const l = seg.len * ease(t);
      seg.el.style.strokeDashoffset = seg.len - l;
      const p = seg.el.getPointAtLength(l);
      const q = seg.el.getPointAtLength(Math.min(seg.len, l + 1));
      const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      mover.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle}) scale(${seg.mode === "fly" ? 1.45 : 1.3})`);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function resetRoute() {
  routeGroup.classList.remove("is-fading");
  for (const seg of SEGMENTS) seg.el.style.strokeDashoffset = seg.len;
  Object.values(stops).forEach((s) => s.classList.remove("is-visible"));
}

let animToken = null;

async function playRoute(token) {
  while (!token.cancelled) {
    resetRoute();
    await sleep(600);
    for (const seg of SEGMENTS) {
      if (token.cancelled) return;
      await animateSegment(seg, token);
      if (seg.stop) stops[seg.stop].classList.add("is-visible");
      await sleep(seg.pause);
    }
    plane.setAttribute("opacity", 0);
    routeGroup.classList.add("is-fading");
    await sleep(1200);
  }
}

export function startAnimation() {
  if (animToken) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const seg of SEGMENTS) seg.el.style.strokeDashoffset = 0;
    Object.values(stops).forEach((s) => s.classList.add("is-visible"));
    return;
  }
  animToken = { cancelled: false };
  playRoute(animToken);
}

export function stopAnimation() {
  if (animToken) animToken.cancelled = true;
  animToken = null;
}
