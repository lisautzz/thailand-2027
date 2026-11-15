// =========================================================
// FORMULAR-DIALOG
// Ein einziger Dialog für alle Bearbeiten-Fenster der Seite.
//
// openForm({
//   title: "Aktivität",
//   fields: [ { name: "title", label: "Titel", type: "text", required: true }, ... ],
//   values: { title: "Kochkurs" },
//   onSave: (values) => { ... },
//   onDelete: () => { ... },        // optional: zeigt "Löschen"-Button
// })
//
// Feldtypen: text, textarea, date, time, number, select, checkbox,
//            checks (mehrere Häkchen → Array), row (Felder nebeneinander)
// =========================================================
import { esc } from "./utils.js";

let dialog;

// Kurze Meldung unten am Bildschirm
export function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("is-visible"), 3500);
}

function fieldHtml(f, value) {
  if (f.type === "row") {
    return `<div class="field-row">${f.fields.map((sub) => fieldHtml(sub, value?.[sub.name])).join("")}</div>`;
  }

  const req = f.required ? " required" : "";
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
  const hint = f.hint ? `<small class="field__hint">${esc(f.hint)}</small>` : "";
  const attrs = ["min", "max", "step"].map((a) => (f[a] != null ? ` ${a}="${esc(f[a])}"` : "")).join("");

  switch (f.type) {
    case "textarea":
      return `<label class="field"><span>${esc(f.label)}</span>
        <textarea name="${f.name}" rows="${f.rows || 3}"${ph}${req}>${esc(value)}</textarea>${hint}</label>`;

    case "select": {
      const opts = f.options
        .map((o) => (typeof o === "string" ? { value: o, label: o } : o))
        .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`)
        .join("");
      return `<label class="field"><span>${esc(f.label)}</span><select name="${f.name}"${req}>${opts}</select>${hint}</label>`;
    }

    case "checkbox":
      return `<label class="field field--check"><input type="checkbox" name="${f.name}"${value ? " checked" : ""}>
        <span>${esc(f.label)}</span></label>`;

    case "checks": {
      const boxes = f.options
        .map((o) => `<label class="chip-check"><input type="checkbox" name="${f.name}" value="${esc(o)}"${(value || []).includes(o) ? " checked" : ""}><span>${esc(o)}</span></label>`)
        .join("");
      return `<fieldset class="field"><legend>${esc(f.label)}</legend><div class="chip-checks">${boxes}</div>${hint}</fieldset>`;
    }

    default:
      return `<label class="field"><span>${esc(f.label)}</span>
        <input type="${f.type || "text"}" name="${f.name}" value="${esc(value)}"${ph}${req}${attrs}>${hint}</label>`;
  }
}

function collect(form, fields) {
  const out = {};
  const flat = fields.flatMap((f) => (f.type === "row" ? f.fields : [f]));
  for (const f of flat) {
    if (f.type === "checkbox") out[f.name] = form.elements[f.name].checked;
    else if (f.type === "checks") out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((i) => i.value);
    else if (f.type === "number") out[f.name] = form.elements[f.name].value === "" ? null : parseFloat(form.elements[f.name].value);
    else out[f.name] = form.elements[f.name].value.trim();
  }
  return out;
}

export function openForm({ title, fields, values = {}, submitLabel = "Speichern", onSave, onDelete }) {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "dialog";
    document.body.append(dialog);
  }

  // Werte für "row"-Felder durchreichen
  const valueFor = (f) => (f.type === "row" ? values : values[f.name]);

  dialog.innerHTML = `<form method="dialog">
    <h3 class="dialog__title">${esc(title)}</h3>
    ${fields.map((f) => fieldHtml(f, valueFor(f))).join("")}
    <div class="dialog__actions">
      ${onDelete ? '<button type="button" class="btn btn--danger" data-delete>Löschen</button>' : ""}
      <span class="dialog__spacer"></span>
      <button class="btn btn--ghost-dark" value="cancel" formnovalidate>Abbrechen</button>
      <button class="btn btn--primary" value="save">${esc(submitLabel)}</button>
    </div>
  </form>`;

  const form = dialog.querySelector("form");
  dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
    if (confirm("Wirklich löschen?")) dialog.close("delete");
  });

  dialog.onclose = () => {
    if (dialog.returnValue === "save") onSave?.(collect(form, fields));
    if (dialog.returnValue === "delete") onDelete?.();
  };

  dialog.returnValue = "";
  dialog.showModal();
  form.querySelector("input:not([type=checkbox]), textarea")?.focus();
}
