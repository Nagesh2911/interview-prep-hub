/* InterviewPrep Hub: main app (routing, sidebar, dashboard, question cards). */
(function (IPH) {
  "use strict";

  const $ = id => document.getElementById(id);
  const PAGE_SIZE = 40;                       // cards rendered per batch
  const NAV_KEY = "iph.navCollapsed";
  const STATUS_VIEWS = ["important", "revision", "done"];

  // Current screen: dashboard | all | subject | important | revision | done
  const view = { type: "dashboard", subject: null };

  let list = [];                // questions shown in the current view (after search + filters)
  let shown = 0;                // how many cards are rendered
  let searchTerms = [];
  const collapsed = new Set();  // cards with the answer text hidden
  const openNotes = new Set();  // cards with the notes box open
  const noteTimers = {};
  const collapsedGroups = new Set(loadJSON(NAV_KEY, []));

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  /* =========================================================
     Routing with the URL hash, so refresh and Back keep the view
     #/   #/all   #/important   #/revision   #/done   #/subject/<name>
     ========================================================= */
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const type = parts[0] || "dashboard";
    if (type === "subject") return { type, subject: decodeURIComponent(parts.slice(1).join("/")) };
    if (type === "all" || STATUS_VIEWS.includes(type)) return { type, subject: null };
    return { type: "dashboard", subject: null };
  }

  function hashFor(type, subject) {
    if (type === "subject") return "#/subject/" + encodeURIComponent(subject);
    return type === "dashboard" ? "#/" : "#/" + type;
  }

  function navigate(type, subject = null) {
    const target = hashFor(type, subject);
    if (location.hash === target || (target === "#/" && !location.hash)) route();
    else location.hash = target;
    closeSidebar();
  }

  function route() {
    const next = parseHash();
    if (next.type === "subject" && !IPH.questions.subjects().includes(next.subject)) {
      next.type = "dashboard";
      next.subject = null;
    }
    view.type = next.type;
    view.subject = next.subject;
    render(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // Typing in the search box on the dashboard searches all questions.
  function effectiveType() {
    return view.type === "dashboard" && searchTerms.length ? "all" : view.type;
  }

  function titleFor(type) {
    if (type === "subject") return view.subject;
    if (type === "all" && view.type === "dashboard") return "Search results";
    return {
      dashboard: "Dashboard",
      all: "All questions",
      important: "★ Important",
      revision: "🔁 Need revision",
      done: "✓ Completed"
    }[type];
  }

  function baseList(type) {
    const all = IPH.questions.getAll();
    if (type === "subject") return IPH.questions.bySubject(view.subject);
    if (STATUS_VIEWS.includes(type)) return all.filter(q => IPH.progress.has(type, q.id));
    return all;
  }

  /* =========================================================
     Main render
     ========================================================= */
  function render(resetPaging) {
    searchTerms = IPH.search.terms($("search").value);
    const type = effectiveType();
    renderNav();

    if (type === "dashboard") {
      $("filterbar").hidden = true;
      $("loadMore").innerHTML = "";
      list = [];
      renderDashboard();
      return;
    }

    $("filterbar").hidden = false;
    list = baseList(type).filter(q => IPH.filters.matches(q) && IPH.search.matches(q, searchTerms));
    $("viewTitle").textContent = titleFor(type);
    $("viewCount").textContent = `${list.length} ${list.length === 1 ? "question" : "questions"}`;

    shown = resetPaging ? Math.min(PAGE_SIZE, list.length) : Math.min(Math.max(shown, PAGE_SIZE), list.length);
    $("content").innerHTML = list.length
      ? `<div class="cards" id="cards">${list.slice(0, shown).map((q, n) => cardHtml(q, n, type)).join("")}</div>`
      : emptyHtml(type);

    updateCollapseLabel();
    renderLoadMore();
    highlightPass();
  }

  function emptyHtml(type) {
    if (searchTerms.length || IPH.filters.active()) {
      return `<div class="empty"><b>No questions match</b>Try another keyword, or
        <button class="link-btn" data-action="reset-search">clear search and filters</button>.</div>`;
    }
    const messages = {
      important: ["No important questions yet", "Click ☆ Important on any question to save it here."],
      revision: ["Nothing to revise", "Click 🔁 Revise on a question, or rate it “Need revision” in interview mode."],
      done: ["No completed questions yet", "Click ✓ Done when you can answer a question confidently."]
    };
    const [title, text] = messages[type] || ["No questions", ""];
    return `<div class="empty"><b>${title}</b>${text}</div>`;
  }

  /* =========================================================
     Sidebar
     ========================================================= */
  function renderNav() {
    const term = $("navSearch").value.toLowerCase().trim();
    const all = IPH.questions.getAll();

    const fixed = [
      ["dashboard", "▦", "Dashboard", null],
      ["all", "☰", "All questions", all.length],
      ["important", "★", "Important", IPH.progress.count("important", all)],
      ["revision", "🔁", "Need revision", IPH.progress.count("revision", all)],
      ["done", "✓", "Completed", IPH.progress.count("done", all)]
    ];

    let html = fixed
      .filter(([, , label]) => !term || label.toLowerCase().includes(term))
      .map(([type, icon, label, count]) => `
        <button class="nav-item${view.type === type ? " active" : ""}" data-nav="${type}" type="button">
          <span aria-hidden="true">${icon}</span><span class="label">${label}</span>
          ${count === null ? "" : `<span class="count">${count}</span>`}
        </button>`)
      .join("");
    if (html) html += `<div class="nav-divider"></div>`;

    IPH.questions.groups().forEach(group => {
      const groupHit = term && group.name.toLowerCase().includes(term);
      const subjects = group.subjects.filter(s => !term || groupHit || s.toLowerCase().includes(term));
      if (!subjects.length) return;

      // Searching, or the open subject is inside: keep the group expanded.
      const open = Boolean(term) || subjects.includes(view.subject) || !collapsedGroups.has(group.name);
      const total = subjects.reduce((n, s) => n + IPH.questions.bySubject(s).length, 0);
      html += `
        <div class="nav-group${open ? " open" : ""}">
          <button class="nav-group-head" data-group="${IPH.esc(group.name)}" aria-expanded="${open}" type="button">
            <span class="chev" aria-hidden="true">›</span><span class="label">${IPH.esc(group.name)}</span>
            <span class="count">${total}</span>
          </button>
          ${open ? subjects.map(subjectNavHtml).join("") : ""}
        </div>`;
    });

    $("nav").innerHTML = html || `<div class="nav-empty">No subject found</div>`;
  }

  function subjectNavHtml(subject) {
    const questions = IPH.questions.bySubject(subject);
    const done = IPH.progress.count("done", questions);
    const pct = questions.length ? Math.round((done / questions.length) * 100) : 0;
    const active = view.type === "subject" && view.subject === subject;
    return `
      <button class="nav-item sub${active ? " active" : ""}" data-subject="${IPH.esc(subject)}" type="button"
              title="${done} of ${questions.length} completed">
        <span class="label">${IPH.esc(subject)}</span>
        <span class="nav-progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="count">${questions.length}</span>
      </button>`;
  }

  function openSidebar() {
    $("sidebar").classList.add("open");
    $("sidebarBackdrop").classList.add("show");
  }

  function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebarBackdrop").classList.remove("show");
  }

  /* =========================================================
     Dashboard
     ========================================================= */
  function renderDashboard() {
    const all = IPH.questions.getAll();
    const done = IPH.progress.count("done", all);
    const important = IPH.progress.count("important", all);
    const revision = IPH.progress.count("revision", all);
    const notes = IPH.notes.count(all);
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;
    const groups = IPH.questions.groups();

    $("viewTitle").textContent = "Dashboard";
    $("viewCount").textContent = `${IPH.questions.subjects().length} subjects · ${all.length} questions`;

    $("content").innerHTML = `
      <section class="dash-hero">
        <h2>${done ? "Keep going 💪" : "Welcome to InterviewPrep Hub 👋"}</h2>
        <p>Pick a subject from the sidebar, or practise like a real interview.</p>
        <div class="progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <div class="progress-label">${done} of ${all.length} questions completed (${pct}%)</div>
        <div class="dash-actions">
          <button class="btn btn-accent" data-action="interview" data-source="todo" type="button">🎤 Quick interview (10 random)</button>
          ${revision ? `<button class="btn" data-action="interview" data-source="revision" type="button">🔁 Practise need-revision (${revision})</button>` : ""}
          ${important ? `<button class="btn" data-action="interview" data-source="important" type="button">★ Practise important (${important})</button>` : ""}
        </div>
      </section>

      <div class="stats">
        <button class="stat" data-action="open-view" data-view="all" type="button"><div class="value">${all.length}</div><div class="name">Total questions</div></button>
        <button class="stat" data-action="open-view" data-view="done" type="button"><div class="value">${done}</div><div class="name">✓ Completed</div></button>
        <button class="stat" data-action="open-view" data-view="important" type="button"><div class="value">${important}</div><div class="name">★ Important</div></button>
        <button class="stat" data-action="open-view" data-view="revision" type="button"><div class="value">${revision}</div><div class="name">🔁 Need revision</div></button>
        <div class="stat"><div class="value">${notes}</div><div class="name">📝 With notes</div></div>
      </div>

      ${groups.map(group => `
        <section class="dash-group">
          <h3>${IPH.esc(group.name)}</h3>
          <div class="tiles">${group.subjects.map(tileHtml).join("")}</div>
        </section>`).join("")}`;
  }

  function tileHtml(subject) {
    const questions = IPH.questions.bySubject(subject);
    const done = IPH.progress.count("done", questions);
    const pct = questions.length ? Math.round((done / questions.length) * 100) : 0;
    return `
      <button class="tile" data-action="open-subject" data-subject="${IPH.esc(subject)}" type="button">
        <span class="name">${IPH.esc(subject)}</span>
        <span class="meta">${questions.length} questions · ${done} done</span>
        <span class="progress-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      </button>`;
  }

  /* =========================================================
     Question card
     ========================================================= */
  function cardHtml(q, n, type) {
    const showSubject = type !== "subject";
    const hasNote = IPH.notes.has(q.id);
    const isCollapsed = collapsed.has(q.id);
    return `
      <article class="card${IPH.progress.has("done", q.id) ? " is-done" : ""}${isCollapsed ? " collapsed" : ""}" data-id="${IPH.esc(q.id)}">
        <div class="card-head">
          <span class="qbadge">Q${n + 1}</span>
          ${showSubject ? `<span class="chip chip-subject">${IPH.esc(q.subject)}</span>` : ""}
          ${q.level ? `<span class="chip level-${q.level.toLowerCase()}">${q.level}</span>` : ""}
          <div class="card-tools">${toolsHtml(q)}</div>
        </div>
        <h2 class="question" data-action="toggle-answer" title="Click to show or hide the answer">${IPH.search.highlight(q.question, searchTerms)}</h2>
        <div class="answer-box">${answerHtml(q, searchTerms)}</div>
        <div class="card-actions">
          <button class="btn btn-small" data-action="toggle-answer" type="button">${isCollapsed ? "Show answer" : "Hide answer"}</button>
          <button class="btn btn-small${hasNote ? " note-flag" : ""}" data-action="notes" type="button">📝 ${hasNote ? "My notes ✓" : "Add notes"}</button>
        </div>
        ${openNotes.has(q.id) ? notesHtml(q) : ""}
      </article>`;
  }

  function toolsHtml(q) {
    const done = IPH.progress.has("done", q.id);
    const important = IPH.progress.has("important", q.id);
    const revision = IPH.progress.has("revision", q.id);
    return [
      toggleHtml("done", done, "✓", "Done", "Mark as completed"),
      toggleHtml("important", important, important ? "★" : "☆", "Important", "Mark as important"),
      toggleHtml("revision", revision, "🔁", "Revise", "Add to the need-revision list")
    ].join("");
  }

  function toggleHtml(name, on, icon, label, title) {
    return `<button class="toggle t-${name}${on ? " on" : ""}" data-action="toggle-${name}" aria-pressed="${on}" title="${title}" type="button">
      <span aria-hidden="true">${icon}</span><span class="t-label">${label}</span></button>`;
  }

  // Shared with interview mode.
  function answerHtml(q, terms = []) {
    return `
      <div class="answer-head"><span class="a-badge">A</span>Answer</div>
      <div class="answer-body">
        <p class="answer-text">${IPH.search.highlight(q.answer, terms)}</p>
        ${q.points.length ? `<ul class="answer-points">${q.points.map(pointHtml).join("")}</ul>` : ""}
        ${q.code ? codeHtml(q) : ""}
      </div>`;
  }

  // "Term = meaning" or "Term: meaning" becomes "**Term** – meaning".
  function pointHtml(point) {
    const m = point.match(/^([^,()[\]=]{1,40}?)\s(?:=|→)\s(.+)$/) || point.match(/^([^:()]{2,30}):\s(.+)$/);
    return m ? `<li><b>${IPH.esc(m[1])}</b> – ${IPH.esc(m[2])}</li>` : `<li>${IPH.esc(point)}</li>`;
  }

  function codeHtml(q) {
    const lang = q.language;
    return `
      <div class="code-block">
        <div class="code-head">
          <span>${IPH.LANG_LABEL[lang] || "Code"}</span>
          <button class="copy-btn" data-action="copy" type="button">⧉ Copy</button>
        </div>
        <pre><code class="language-${IPH.HLJS_CLASS[lang] || lang}">${IPH.esc(q.code)}</code></pre>
      </div>`;
  }

  function notesHtml(q) {
    return `
      <div class="notes">
        <div class="notes-head"><span>📝 My notes</span><span class="saved">Saved</span></div>
        <textarea data-note placeholder="Write your own answer, an example from your projects, or anything to remember…">${IPH.esc(IPH.notes.get(q.id))}</textarea>
      </div>`;
  }

  /* ---------- Card actions ---------- */
  function toggleProgress(name, id, card) {
    const on = IPH.progress.toggle(name, id);
    const q = IPH.questions.byId(id);

    // In a list that depends on this status, refresh so the card appears or disappears.
    if (view.type === name || IPH.filters.dependsOnProgress()) {
      render(false);
    } else {
      card.querySelector(".card-tools").innerHTML = toolsHtml(q);
      card.classList.toggle("is-done", IPH.progress.has("done", id));
      renderNav();
    }
    const labels = { done: ["Marked as completed", "Marked as not completed"],
                     important: ["Added to Important", "Removed from Important"],
                     revision: ["Added to Need revision", "Removed from Need revision"] };
    toast(labels[name][on ? 0 : 1]);
  }

  function toggleAnswer(id, card) {
    const hide = !collapsed.has(id);
    hide ? collapsed.add(id) : collapsed.delete(id);
    card.classList.toggle("collapsed", hide);
    card.querySelector('.card-actions [data-action="toggle-answer"]').textContent = hide ? "Show answer" : "Hide answer";
    updateCollapseLabel();
  }

  function toggleNotes(id, card) {
    const box = card.querySelector(".notes");
    if (box) {
      openNotes.delete(id);
      box.remove();
      return;
    }
    openNotes.add(id);
    card.insertAdjacentHTML("beforeend", notesHtml(IPH.questions.byId(id)));
    card.querySelector(".notes textarea").focus();
  }

  function saveNote(textarea) {
    const card = textarea.closest(".card");
    const id = card.dataset.id;
    clearTimeout(noteTimers[id]);
    noteTimers[id] = setTimeout(() => {
      IPH.notes.set(id, textarea.value);
      const badge = card.querySelector(".notes .saved");
      badge.classList.add("show");
      setTimeout(() => badge.classList.remove("show"), 900);
      const btn = card.querySelector('[data-action="notes"]');
      const has = IPH.notes.has(id);
      btn.classList.toggle("note-flag", has);
      btn.textContent = has ? "📝 My notes ✓" : "📝 Add notes";
    }, 400);
  }

  function copyCode(id, btn) {
    const q = IPH.questions.byId(id);
    const text = q ? q.code : "";
    const copied = () => {
      btn.textContent = "✓ Copied";
      setTimeout(() => (btn.textContent = "⧉ Copy"), 1200);
    };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); copied(); } catch (e) { toast("Copy failed"); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(copied, fallback);
    else fallback();
  }

  function updateCollapseLabel() {
    const allHidden = list.length > 0 && list.every(q => collapsed.has(q.id));
    $("collapseAll").textContent = allHidden ? "Show all answers" : "Hide all answers";
  }

  function toggleCollapseAll() {
    const allHidden = list.length > 0 && list.every(q => collapsed.has(q.id));
    list.forEach(q => (allHidden ? collapsed.delete(q.id) : collapsed.add(q.id)));
    render(false);
  }

  /* ---------- Paging: render 40 cards at a time ---------- */
  const moreObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) showMore();
      }, { rootMargin: "600px" })
    : null;

  function renderLoadMore() {
    if (moreObserver) moreObserver.disconnect();
    const left = list.length - shown;
    $("loadMore").innerHTML = left > 0
      ? `<button class="btn" id="moreBtn" type="button">Show more (${left} left)</button>`
      : "";
    if (left > 0 && moreObserver) moreObserver.observe($("moreBtn"));
  }

  function showMore() {
    const cards = $("cards");
    if (!cards || shown >= list.length) return;
    const start = shown;
    shown = Math.min(shown + PAGE_SIZE, list.length);
    const type = effectiveType();
    cards.insertAdjacentHTML("beforeend", list.slice(start, shown).map((q, i) => cardHtml(q, start + i, type)).join(""));
    renderLoadMore();
    highlightPass();
  }

  /* ---------- Syntax colours (highlight.js), only for code that scrolls into view ---------- */
  function highlightCode(el) {
    if (!window.hljs || el.dataset.hl) return false;
    el.dataset.hl = "1";
    try { window.hljs.highlightElement(el); } catch (e) { /* leave it plain */ }
    return true;
  }

  const codeObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting && highlightCode(entry.target)) codeObserver.unobserve(entry.target);
      }), { rootMargin: "400px" })
    : null;

  function highlightPass() {
    $("content").querySelectorAll("pre code:not([data-hl])").forEach(el => {
      if (codeObserver) {
        codeObserver.unobserve(el);
        codeObserver.observe(el);
      } else {
        highlightCode(el);
      }
    });
  }

  function highlightNow(root) {
    root.querySelectorAll("pre code:not([data-hl])").forEach(highlightCode);
  }

  IPH.onHighlighterReady = function () {
    highlightPass();
    highlightNow($("imBody"));
  };

  /* =========================================================
     Export / import progress (LocalStorage backup)
     ========================================================= */
  function exportProgress() {
    const data = {
      app: "InterviewPrep Hub",
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: IPH.progress.snapshot(),
      notes: IPH.notes.all()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `interviewprep-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast("Progress exported");
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.progress !== "object") throw new Error("not a progress file");
        if (!confirm("Replace your current progress and notes with the imported file?")) return;
        IPH.progress.restore(data.progress);
        IPH.notes.restore(data.notes || {});
        render(false);
        toast("Progress imported");
      } catch (e) {
        toast("This file is not a valid InterviewPrep Hub progress file");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2000);
  }

  /* =========================================================
     Events
     ========================================================= */
  function bindEvents() {
    // Sidebar
    $("nav").addEventListener("click", e => {
      const item = e.target.closest("[data-nav], [data-subject], [data-group]");
      if (!item) return;
      if (item.dataset.nav) navigate(item.dataset.nav);
      else if (item.dataset.subject) navigate("subject", item.dataset.subject);
      else {
        const name = item.dataset.group;
        collapsedGroups.has(name) ? collapsedGroups.delete(name) : collapsedGroups.add(name);
        saveJSON(NAV_KEY, [...collapsedGroups]);
        renderNav();
      }
    });

    $("navSearch").addEventListener("input", renderNav);
    $("navSearch").addEventListener("keydown", e => {
      if (e.key === "Escape") {
        e.target.value = "";
        renderNav();
      } else if (e.key === "Enter") {
        const first = $("nav").querySelector("[data-subject]") || $("nav").querySelector("[data-nav]");
        if (first) first.click();
      }
    });

    $("menuBtn").addEventListener("click", openSidebar);
    $("sidebarBackdrop").addEventListener("click", closeSidebar);
    $("exportBtn").addEventListener("click", exportProgress);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", e => {
      if (e.target.files[0]) importProgress(e.target.files[0]);
      e.target.value = "";
    });

    // Top bar
    let searchTimer;
    $("search").addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        render(true);
        window.scrollTo({ top: 0, behavior: "instant" });
      }, 150);
    });
    $("themeBtn").addEventListener("click", () => toast(IPH.theme.toggle() === "dark" ? "Dark theme" : "Light theme"));
    $("interviewBtn").addEventListener("click", () => IPH.interview.open({ source: "current" }));

    // Filters
    $("levelFilter").addEventListener("change", e => { IPH.filters.set("level", e.target.value); render(true); });
    $("statusFilter").addEventListener("change", e => { IPH.filters.set("status", e.target.value); render(true); });
    $("clearFilters").addEventListener("click", resetFilters);
    $("collapseAll").addEventListener("click", toggleCollapseAll);

    // Cards and dashboard (event delegation)
    $("content").addEventListener("click", e => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action;

      if (action === "open-subject") return navigate("subject", el.dataset.subject);
      if (action === "open-view") return navigate(el.dataset.view);
      if (action === "interview") return IPH.interview.open({ source: el.dataset.source, autostart: true });
      if (action === "reset-search") {
        $("search").value = "";
        return resetFilters();
      }

      const card = el.closest(".card");
      if (!card) return;
      const id = card.dataset.id;
      if (action.startsWith("toggle-") && action !== "toggle-answer") toggleProgress(action.slice(7), id, card);
      else if (action === "toggle-answer") toggleAnswer(id, card);
      else if (action === "notes") toggleNotes(id, card);
      else if (action === "copy") copyCode(id, el);
    });

    $("content").addEventListener("input", e => {
      if (e.target.matches("textarea[data-note]")) saveNote(e.target);
    });

    $("loadMore").addEventListener("click", e => {
      if (e.target.id === "moreBtn") showMore();
    });

    // Keyboard: "/" focuses search, Esc clears it
    document.addEventListener("keydown", e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "/" && !typing && $("interviewModal").hidden) {
        e.preventDefault();
        $("search").focus();
      } else if (e.key === "Escape" && document.activeElement === $("search") && $("search").value) {
        $("search").value = "";
        render(true);
      }
    });

    window.addEventListener("hashchange", route);
  }

  function resetFilters() {
    IPH.filters.reset();
    $("levelFilter").value = "all";
    $("statusFilter").value = "all";
    render(true);
  }

  /* =========================================================
     Start
     ========================================================= */
  async function init() {
    bindEvents();
    $("content").innerHTML = `<div class="empty">Loading questions…</div>`;
    try {
      await IPH.questions.load();
    } catch (e) {
      $("content").innerHTML = `<div class="empty"><b>Could not load the questions</b>${IPH.esc(e.message)}</div>`;
      return;
    }
    route();
  }

  IPH.app = {
    answerHtml,
    highlightNow,
    copyCode,
    navigate,
    render,
    toast,
    // Questions in the current view, for interview mode ("Current view" option)
    currentView: () => (effectiveType() === "dashboard" ? null : { title: titleFor(effectiveType()), list: [...list] })
  };

  init();
})(window.IPH = window.IPH || {});
