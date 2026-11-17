// =========================================================
// AUSGABEN-TRACKER
// Alle Ausgaben werden 50/50 geteilt.
//
// expenses: [{ id, type, title, amount, paidBy, category, date, note }]
//   type "spent"    = schon bezahlt (paidBy = wer hat gezahlt)
//   type "planned"  = geplante / geschätzte Ausgabe (noch nicht bezahlt)
//   type "transfer" = Ausgleichszahlung zwischen euch (paidBy = wer hat überwiesen)
// =========================================================
import { PEOPLE, EXPENSE_CATEGORIES } from "./config.js";
import { store, newId } from "./store.js";
import { $, esc, euro, todayIso } from "./utils.js";
import { openForm } from "./ui.js";

let expenses = [];

export function load() {
  expenses = store.load("expenses", []);
}
const [A, B] = PEOPLE;
let catFilter = "alle"; // Kategorie-Filter auf der Seite

function save() {
  store.save("expenses", expenses);
  render();
}

const sum = (list) => list.reduce((s, e) => s + (e.amount || 0), 0);

// Saldo: positiv = A bekommt Geld von B, negativ = A schuldet B
function balanceOfA() {
  const spent = expenses.filter((e) => e.type === "spent");
  const paidA = sum(spent.filter((e) => e.paidBy === A));
  const half = sum(spent) / 2;
  const transfersA = sum(expenses.filter((e) => e.type === "transfer" && e.paidBy === A));
  const transfersB = sum(expenses.filter((e) => e.type === "transfer" && e.paidBy === B));
  return paidA - half + transfersA - transfersB;
}

export function render() {
  const allSpent = expenses.filter((e) => e.type === "spent");
  const inCat = (e) => catFilter === "alle" || (e.category || "Sonstiges") === catFilter;
  const spent = allSpent.filter(inCat);
  const planned = expenses.filter((e) => e.type === "planned" && inCat(e));
  const transfers = expenses.filter((e) => e.type === "transfer");
  const sSpent = sum(spent), sPlanned = sum(planned), total = sSpent + sPlanned;

  // Filter-Leiste: Kategorien mit ihrer Summe (ausgegeben + geplant)
  const costs = expenses.filter((e) => e.type !== "transfer");
  const cats = [...new Set([...EXPENSE_CATEGORIES, ...costs.map((e) => e.category || "Sonstiges")])]
    .filter((c) => costs.some((e) => (e.category || "Sonstiges") === c));
  if (catFilter !== "alle" && !cats.includes(catFilter)) catFilter = "alle";
  $("exp-filter").hidden = !cats.length;
  $("exp-filter").innerHTML = [["alle", "Alle", sum(costs)], ...cats.map((c) => [c, c, sum(costs.filter((e) => (e.category || "Sonstiges") === c))])]
    .map(([v, label, amount]) => `<button class="cat${v === catFilter ? " is-active" : ""}" data-cat="${esc(v)}">
      ${esc(label)}<span>${euro(amount)}</span></button>`).join("");

  // Kennzahlen (bei aktivem Filter nur für diese Kategorie)
  $("exp-stats").innerHTML = `
    <div class="stat"><span class="stat__label">Schon ausgegeben</span><span class="stat__value">${euro(sSpent)}</span></div>
    <div class="stat"><span class="stat__label">Noch geplant</span><span class="stat__value">${euro(sPlanned)}</span></div>
    <div class="stat stat--total"><span class="stat__label">${catFilter === "alle" ? "Geschätzt gesamt" : "Gesamt " + esc(catFilter)}</span><span class="stat__value">${euro(total)}</span>
      <span class="stat__sub">${euro(total / 2)} pro Person</span></div>`;

  // Wer schuldet wem?
  const bal = balanceOfA();
  const paidLine = PEOPLE.map((p) => `${esc(p)} hat ${euro(sum(allSpent.filter((e) => e.paidBy === p)))} bezahlt`).join(" · ");
  if (Math.abs(bal) < 0.005) {
    $("exp-balance").innerHTML = `<p class="balance__main">Ihr seid quitt.</p><p class="balance__sub">${paidLine}</p>`;
  } else {
    const [debtor, creditor] = bal > 0 ? [B, A] : [A, B];
    $("exp-balance").innerHTML = `
      <p class="balance__main">${esc(debtor)} schuldet ${esc(creditor)} <strong>${euro(Math.abs(bal))}</strong></p>
      <p class="balance__sub">${paidLine}</p>
      <button class="btn btn--small btn--ghost-dark" id="exp-settle">Ausgleich eintragen</button>`;
    $("exp-settle").onclick = () => settle(debtor, Math.abs(bal));
  }

  // Listen
  const row = (e) => {
    const meta = [e.category, e.date && new Date(e.date + "T00:00:00Z").toLocaleDateString("de-DE", { timeZone: "UTC", day: "numeric", month: "short" }),
      e.type === "spent" && `bezahlt von ${e.paidBy}`, e.type === "transfer" && `${e.paidBy} → ${e.paidBy === A ? B : A}`]
      .filter(Boolean).map(esc).join(" · ");
    return `<li class="exp">
      <button class="exp__main" data-edit="${e.id}">
        <span class="exp__title">${esc(e.title)}</span>
        <span class="exp__meta">${meta}</span>
        ${e.note ? `<span class="exp__note">${esc(e.note)}</span>` : ""}
      </button>
      ${e.type === "planned" ? `<button class="btn btn--small btn--ghost-dark" data-pay="${e.id}">Bezahlt</button>` : ""}
      <span class="exp__amount">${euro(e.amount)}</span>
    </li>`;
  };
  const byDate = (a, b) => (b.date || "").localeCompare(a.date || "");
  const list = (items, empty) => (items.length ? items.sort(byDate).map(row).join("") : `<li class="empty">${empty}</li>`);

  $("exp-spent").innerHTML = list(spent, "Noch nichts ausgegeben.");
  $("exp-planned").innerHTML = list(planned, "Noch keine geplanten Ausgaben.");
  // Ausgleichszahlungen gehören zu keiner Kategorie – nur ohne Filter zeigen
  $("exp-transfers-wrap").hidden = !transfers.length || catFilter !== "alle";
  $("exp-transfers").innerHTML = list(transfers, "");
  $("exp-spent-sum").textContent = euro(sSpent);
  $("exp-planned-sum").textContent = euro(sPlanned);
}

function fieldsFor(type) {
  const f = [
    { name: "title", label: "Wofür?", type: "text", required: true, placeholder: "z. B. Flug Bangkok–Krabi" },
    { type: "row", fields: [
      { name: "amount", label: "Betrag in €", type: "number", required: true, min: 0, step: "0.01" },
      { name: "category", label: "Kategorie", type: "select", options: EXPENSE_CATEGORIES },
    ] },
  ];
  if (type === "spent") {
    f.push({ type: "row", fields: [
      { name: "paidBy", label: "Bezahlt von", type: "select", options: PEOPLE },
      { name: "date", label: "Datum", type: "date" },
    ] });
  } else {
    f.push({ name: "date", label: "Fällig / geplant am (optional)", type: "date" });
  }
  f.push({ name: "note", label: "Notiz", type: "textarea", rows: 2 });
  return f;
}

function edit(exp, isNew = false) {
  if (exp.type === "transfer") return editTransfer(exp);
  openForm({
    title: isNew ? (exp.type === "spent" ? "Neue Ausgabe" : "Geplante Ausgabe") : "Ausgabe bearbeiten",
    fields: [
      ...fieldsFor(exp.type),
      ...(isNew ? [] : [{ name: "type", label: "Status", type: "select",
        options: [{ value: "spent", label: "Schon bezahlt" }, { value: "planned", label: "Geplant" }] }]),
    ],
    values: exp,
    onSave: (v) => {
      const data = { ...exp, ...v };
      if (data.type === "spent" && !data.paidBy) data.paidBy = A;
      if (isNew) expenses.push({ ...data, id: newId() });
      else Object.assign(expenses.find((e) => e.id === exp.id), data);
      save();
    },
    onDelete: isNew ? null : () => {
      expenses = expenses.filter((e) => e.id !== exp.id);
      save();
    },
  });
}

// Geplante Ausgabe als bezahlt markieren
function markPaid(exp) {
  openForm({
    title: `„${exp.title}“ bezahlt`,
    fields: [
      { type: "row", fields: [
        { name: "amount", label: "Tatsächlicher Betrag in €", type: "number", required: true, min: 0, step: "0.01" },
        { name: "paidBy", label: "Bezahlt von", type: "select", options: PEOPLE },
      ] },
      { name: "date", label: "Datum", type: "date" },
    ],
    values: { amount: exp.amount, paidBy: A, date: todayIso() },
    submitLabel: "Als bezahlt speichern",
    onSave: (v) => {
      const current = expenses.find((e) => e.id === exp.id);
      if (current) Object.assign(current, v, { type: "spent" });
      save();
    },
  });
}

function settle(debtor, amount) {
  editTransfer({ type: "transfer", title: "Ausgleich", amount: Math.round(amount * 100) / 100, paidBy: debtor, date: todayIso(), note: "" }, true);
}

function editTransfer(exp, isNew = false) {
  openForm({
    title: isNew ? "Ausgleichszahlung" : "Ausgleich bearbeiten",
    fields: [
      { type: "row", fields: [
        { name: "amount", label: "Betrag in €", type: "number", required: true, min: 0, step: "0.01" },
        { name: "paidBy", label: "Überwiesen von", type: "select", options: PEOPLE },
      ] },
      { name: "date", label: "Datum", type: "date" },
      { name: "note", label: "Notiz", type: "textarea", rows: 2, placeholder: "z. B. per PayPal, für Flüge + Hotel Bangkok" },
    ],
    values: exp,
    onSave: (v) => {
      if (isNew) expenses.push({ ...exp, ...v, id: newId() });
      else Object.assign(expenses.find((e) => e.id === exp.id), v);
      save();
    },
    onDelete: isNew ? null : () => {
      expenses = expenses.filter((e) => e.id !== exp.id);
      save();
    },
  });
}

export function init() {
  $("exp-add-spent").addEventListener("click", () =>
    edit({ type: "spent", title: "", amount: null, paidBy: A, category: EXPENSE_CATEGORIES[0], date: todayIso(), note: "" }, true));
  $("exp-add-planned").addEventListener("click", () =>
    edit({ type: "planned", title: "", amount: null, category: EXPENSE_CATEGORIES[0], date: "", note: "" }, true));

  $("exp-filter").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]")?.dataset.cat;
    if (!c) return;
    catFilter = c;
    render();
  });

  $("view-ausgaben").addEventListener("click", (e) => {
    const { edit: editId, pay } = e.target.closest("button")?.dataset || {};
    if (editId) edit(expenses.find((x) => x.id === editId));
    if (pay) markPaid(expenses.find((x) => x.id === pay));
  });
}
