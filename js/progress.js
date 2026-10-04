/* Progress tracking: completed, important and need-revision questions.
   Stored in LocalStorage as lists of question IDs. */
(function (IPH) {
  "use strict";

  const KEY = "iph.progress.v1";
  const LISTS = ["done", "important", "revision"];

  let data = load();

  function empty() {
    return Object.fromEntries(LISTS.map(name => [name, new Set()]));
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.fromEntries(LISTS.map(name => [name, new Set(raw[name] || [])]));
    } catch (e) {
      return empty();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot()));
    } catch (e) { /* storage full or blocked: progress stays for this session only */ }
  }

  function has(list, id) {
    return data[list].has(id);
  }

  function set(list, id, on) {
    on ? data[list].add(id) : data[list].delete(id);
    save();
  }

  function toggle(list, id) {
    set(list, id, !has(list, id));
    return has(list, id);
  }

  // Count only IDs that still exist in the question data.
  function count(list, questions) {
    let n = 0;
    for (const q of questions) if (data[list].has(q.id)) n++;
    return n;
  }

  function snapshot() {
    return Object.fromEntries(LISTS.map(name => [name, [...data[name]]]));
  }

  function restore(obj) {
    data = Object.fromEntries(LISTS.map(name => [name, new Set((obj && obj[name]) || [])]));
    save();
  }

  function reset() {
    data = empty();
    save();
  }

  IPH.progress = { LISTS, has, set, toggle, count, snapshot, restore, reset };
})(window.IPH = window.IPH || {});
