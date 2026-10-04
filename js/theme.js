/* Theme: dark / light, saved in LocalStorage.
   The saved theme is applied early by a small inline script in index.html. */
(function (IPH) {
  "use strict";

  const KEY = "iph.theme";

  function current() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  // Browser / installed-app title bar colour for each theme
  const BAR_COLOR = { dark: "#262624", light: "#faf9f5" };

  function set(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", BAR_COLOR[theme] || BAR_COLOR.dark);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* storage blocked */ }
  }

  function toggle() {
    set(current() === "dark" ? "light" : "dark");
    return current();
  }

  IPH.theme = { current, set, toggle };
})(window.IPH = window.IPH || {});
