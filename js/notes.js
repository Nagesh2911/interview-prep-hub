/* Personal notes per question, stored in LocalStorage. */
(function (IPH) {
  "use strict";

  const KEY = "iph.notes.v1";

  let notes = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch (e) { /* storage full or blocked */ }
  }

  function get(id) {
    return notes[id] || "";
  }

  function set(id, text) {
    if (text.trim()) notes[id] = text;
    else delete notes[id];
    save();
  }

  function has(id) {
    return Boolean(notes[id]);
  }

  function count(questions) {
    return questions.reduce((n, q) => n + (notes[q.id] ? 1 : 0), 0);
  }

  function all() {
    return { ...notes };
  }

  function restore(obj) {
    notes = obj && typeof obj === "object" ? { ...obj } : {};
    save();
  }

  IPH.notes = { get, set, has, count, all, restore };
})(window.IPH = window.IPH || {});
