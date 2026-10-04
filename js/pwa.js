/* PWA helpers: "Install app" button, "new version available" banner, online / offline notices.
   The service worker itself is registered by the small script at the bottom of index.html. */
(function (IPH) {
  "use strict";

  const $ = id => document.getElementById(id);
  let installPrompt = null;
  let reloading = false;

  /* ---------- Install button (Chrome, Edge, Android) ---------- */
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();          // show our own button instead of the mini-infobar
    installPrompt = event;
    $("installBtn").hidden = false;
  });

  $("installBtn").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $("installBtn").hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    $("installBtn").hidden = true;
    toast("InterviewPrep Hub installed 🎉");
  });

  /* ---------- New version available ---------- */
  function showUpdate(worker) {
    $("updateBanner").hidden = false;
    $("updateBtn").onclick = () => {
      $("updateBtn").disabled = true;
      worker.postMessage("SKIP_WAITING");
    };
  }

  function watchUpdates(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // "installed" while another version controls the page = an update is ready
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });

    // Check for a new version when the app comes back to the foreground.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {});
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  /* ---------- Online / offline ---------- */
  window.addEventListener("offline", () => toast("You are offline. Saved questions still work."));
  window.addEventListener("online", () => toast("Back online"));

  function toast(message) {
    if (IPH.app && IPH.app.toast) IPH.app.toast(message);
  }

  IPH.pwa = { watchUpdates };
})(window.IPH = window.IPH || {});
