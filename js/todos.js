// =========================================================
// TO-DO-LISTE (mit Beschreibung)
// todos: [{ id, text, description, who, done }]
// =========================================================
import { PEOPLE, DEFAULT_TODOS } from "./config.js";
import { store, newId } from "./store.js";
import { $, esc } from "./utils.js";
import { openForm } from "./ui.js";

let todos = store.load("todos", DEFAULT_TODOS.map((t) => ({ ...t, id: newId(), done: false })));
const whoOptions = [{ value: "beide", label: "Beide" }, ...PEOPLE.map((p) => ({ value: p, label: p }))];

function save() {
  store.save("todos", todos);
  render();
}

export function render() {
  const sorted = [...todos].sort((a, b) => a.done - b.done); // offene zuerst
  $("todo-list").innerHTML = sorted.length
    ? sorted.map((t) => `
      <li class="todo${t.done ? " is-done" : ""}">
        <input type="checkbox" data-toggle="${t.id}" ${t.done ? "checked" : ""} aria-label="Erledigt">
        <div class="todo__body">
          <button class="todo__text" data-edit="${t.id}">${esc(t.text)}</button>
          ${t.description ? `<p class="todo__desc">${esc(t.description)}</p>` : ""}
        </div>
        <span class="todo__who">${esc(t.who)}</span>
        <button class="todo__delete" data-delete="${t.id}" aria-label="Löschen">×</button>
      </li>`).join("")
    : '<li class="empty">Alles erledigt. Jetzt nur noch Koffer packen!</li>';

  $("todo-progress").textContent = `${todos.filter((t) => t.done).length}/${todos.length}`;
}

function edit(todo) {
  openForm({
    title: "To-do bearbeiten",
    fields: [
      { name: "text", label: "To-do", type: "text", required: true },
      { name: "description", label: "Beschreibung", type: "textarea", placeholder: "Details, Links, Fristen …" },
      { name: "who", label: "Wer kümmert sich?", type: "select", options: whoOptions },
    ],
    values: todo,
    onSave: (v) => {
      Object.assign(todo, v);
      save();
    },
    onDelete: () => {
      todos = todos.filter((x) => x.id !== todo.id);
      save();
    },
  });
}

export function init() {
  $("todo-who").innerHTML = whoOptions.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");

  $("todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("todo-text").value.trim();
    if (!text) return;
    todos.push({ id: newId(), text, description: $("todo-desc").value.trim(), who: $("todo-who").value, done: false });
    $("todo-text").value = "";
    $("todo-desc").value = "";
    save();
  });

  $("todo-list").addEventListener("change", (e) => {
    const t = todos.find((x) => x.id === e.target.dataset.toggle);
    if (!t) return;
    t.done = e.target.checked;
    save();
  });

  $("todo-list").addEventListener("click", (e) => {
    const { edit: editId, delete: delId } = e.target.dataset;
    if (editId) edit(todos.find((x) => x.id === editId));
    if (delId) {
      todos = todos.filter((x) => x.id !== delId);
      save();
    }
  });
}
