/* Filters: level and status (completed, important, need revision, notes). */
(function (IPH) {
  "use strict";

  const state = { level: "all", status: "all" };

  function matches(q) {
    if (state.level !== "all" && q.level !== state.level) return false;

    switch (state.status) {
      case "todo": return !IPH.progress.has("done", q.id);
      case "done": return IPH.progress.has("done", q.id);
      case "important": return IPH.progress.has("important", q.id);
      case "revision": return IPH.progress.has("revision", q.id);
      case "notes": return IPH.notes.has(q.id);
      default: return true;
    }
  }

  function set(name, value) {
    state[name] = value;
  }

  function reset() {
    state.level = "all";
    state.status = "all";
  }

  function active() {
    return state.level !== "all" || state.status !== "all";
  }

  // True when a filter depends on progress, so toggling progress must refresh the list.
  function dependsOnProgress() {
    return state.status !== "all";
  }

  IPH.filters = { state, matches, set, reset, active, dependsOnProgress };
})(window.IPH = window.IPH || {});
