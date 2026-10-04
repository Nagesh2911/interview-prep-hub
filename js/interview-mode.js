/* Interview mode: one question at a time, optional timer, reveal the answer,
   rate yourself. "I knew it" marks the question completed; "Need revision" adds it to the revision list. */
(function (IPH) {
  "use strict";

  const $ = id => document.getElementById(id);

  let session = null;      // { items, index, revealed, timer, source, results }
  let timerId = null;
  let lastSource = "current";

  /* ---------- Question pools ---------- */
  function sources() {
    const all = IPH.questions.getAll();
    const current = IPH.app.currentView();
    const options = [];
    if (current && current.list.length) options.push(["current", `Current view: ${current.title} (${current.list.length})`]);
    options.push(["all", `All subjects (${all.length})`]);
    options.push(["todo", `Not completed yet (${all.length - IPH.progress.count("done", all)})`]);
    options.push(["important", `★ Important (${IPH.progress.count("important", all)})`]);
    options.push(["revision", `🔁 Need revision (${IPH.progress.count("revision", all)})`]);
    IPH.questions.subjects().forEach(s => options.push(["subject:" + s, `${s} (${IPH.questions.bySubject(s).length})`]));
    return options;
  }

  function pool(source) {
    const all = IPH.questions.getAll();
    if (source === "current") {
      const current = IPH.app.currentView();
      return current && current.list.length ? current.list : all;
    }
    if (source === "todo") {
      const todo = all.filter(q => !IPH.progress.has("done", q.id));
      return todo.length ? todo : all;
    }
    if (source === "important" || source === "revision") return all.filter(q => IPH.progress.has(source, q.id));
    if (source.startsWith("subject:")) return IPH.questions.bySubject(source.slice(8));
    return all;
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /* ---------- Open / close ---------- */
  function open(options = {}) {
    $("interviewModal").hidden = false;
    document.body.style.overflow = "hidden";
    if (options.autostart && options.source) {
      const items = pool(options.source);
      if (items.length) return start(options.source, { count: 10, shuffle: true, timer: 0 });
    }
    renderSetup(options.source || lastSource);
  }

  function close() {
    stopTimer();
    session = null;
    $("interviewModal").hidden = true;
    document.body.style.overflow = "";
    IPH.app.render(false);          // show progress changes made during the interview
  }

  /* ---------- Setup screen ---------- */
  function renderSetup(selected) {
    stopTimer();
    session = null;
    const options = sources();
    const value = options.some(([v]) => v === selected) ? selected : options[0][0];

    $("imBody").innerHTML = `
      <h2 class="im-title" id="imTitle">🎤 Interview mode</h2>
      <p class="im-sub">Answer out loud first, then reveal the answer and rate yourself honestly.
        Your ratings update your progress.</p>
      <div class="im-form">
        <label class="im-field">Questions from
          <select id="imSource">
            ${options.map(([v, label]) => `<option value="${IPH.esc(v)}"${v === value ? " selected" : ""}>${IPH.esc(label)}</option>`).join("")}
          </select>
        </label>
        <div class="im-row">
          <label class="im-field">Number of questions
            <select id="imCount">
              <option value="5">5</option>
              <option value="10" selected>10</option>
              <option value="20">20</option>
              <option value="0">All</option>
            </select>
          </label>
          <label class="im-field">Time per question
            <select id="imTimer">
              <option value="0">No timer</option>
              <option value="60">1 minute</option>
              <option value="120" selected>2 minutes</option>
              <option value="180">3 minutes</option>
            </select>
          </label>
        </div>
        <label class="im-check"><input type="checkbox" id="imShuffle" checked> Shuffle questions</label>
        <p class="im-hint">Shortcuts: <kbd>Space</kbd> show answer · <kbd>1</kbd> I knew it ·
          <kbd>2</kbd> Need revision · <kbd>→</kbd> skip · <kbd>Esc</kbd> close</p>
        <p class="im-hint" id="imError" role="alert"></p>
        <div class="im-buttons">
          <button class="btn btn-accent" data-im="start" type="button">Start interview</button>
        </div>
      </div>`;
    $("imSource").focus();
  }

  function startFromSetup() {
    const source = $("imSource").value;
    const items = pool(source);
    if (!items.length) {
      $("imError").textContent = "There are no questions in this list yet. Choose another option.";
      return;
    }
    start(source, {
      count: Number($("imCount").value),
      timer: Number($("imTimer").value),
      shuffle: $("imShuffle").checked
    });
  }

  function start(source, { count, timer, shuffle: doShuffle }) {
    lastSource = source;
    let items = [...pool(source)];
    if (doShuffle) shuffle(items);
    if (count) items = items.slice(0, count);
    session = { items, index: 0, revealed: false, timer, source, results: { knew: [], revision: [], skipped: [] } };
    renderQuestion();
  }

  /* ---------- Question screen ---------- */
  function renderQuestion() {
    const q = session.items[session.index];
    const total = session.items.length;
    const pct = Math.round((session.index / total) * 100);
    session.revealed = false;

    $("imBody").innerHTML = `
      <div class="im-top">
        <span>Question ${session.index + 1} of ${total}</span>
        <div class="im-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        ${session.timer ? `<span class="im-timer" id="imClock">${formatTime(session.timer)}</span>` : ""}
      </div>
      <div class="card-head">
        <span class="chip chip-subject">${IPH.esc(q.subject)}</span>
        ${q.level ? `<span class="chip level-${q.level.toLowerCase()}">${q.level}</span>` : ""}
      </div>
      <h2 class="im-question" id="imTitle">${IPH.esc(q.question)}</h2>
      <div id="imAnswerArea">
        <p class="im-hint">Think about your answer (or say it out loud), then reveal it.</p>
        <div class="im-buttons">
          <button class="btn btn-accent" data-im="reveal" type="button">Show answer <kbd>Space</kbd></button>
          <button class="btn" data-im="skip" type="button">Skip →</button>
        </div>
      </div>`;
    startTimer();
  }

  function reveal(timeUp = false) {
    if (!session || session.revealed) return;
    session.revealed = true;
    stopTimer();
    const q = session.items[session.index];
    const area = $("imAnswerArea");
    area.innerHTML = `
      ${timeUp ? `<p class="im-hint">⏰ Time's up. Here is the answer:</p>` : ""}
      <div class="answer-box im-answer" data-id="${IPH.esc(q.id)}">${IPH.app.answerHtml(q)}</div>
      <div class="im-buttons">
        <button class="btn" data-im="knew" type="button">✓ I knew it <kbd>1</kbd></button>
        <button class="btn" data-im="revision" type="button">🔁 Need revision <kbd>2</kbd></button>
        <button class="btn" data-im="skip" type="button">Skip →</button>
      </div>`;
    IPH.app.highlightNow(area);
  }

  function rate(kind) {
    if (!session) return;
    const q = session.items[session.index];
    if (kind === "knew") {
      IPH.progress.set("done", q.id, true);
      IPH.progress.set("revision", q.id, false);
    } else if (kind === "revision") {
      IPH.progress.set("revision", q.id, true);
      IPH.progress.set("done", q.id, false);
    }
    session.results[kind === "skip" ? "skipped" : kind].push(q);
    session.index += 1;
    if (session.index >= session.items.length) renderSummary();
    else renderQuestion();
  }

  /* ---------- Summary ---------- */
  function renderSummary() {
    stopTimer();
    const { knew, revision, skipped } = session.results;
    const total = session.items.length;
    const pct = total ? Math.round((knew.length / total) * 100) : 0;
    const source = session.source;
    session = null;

    $("imBody").innerHTML = `
      <h2 class="im-title" id="imTitle">Interview finished 🎉</h2>
      <p class="im-sub">You answered ${knew.length} of ${total} questions confidently (${pct}%).</p>
      <div class="im-summary">
        <div class="stat"><div class="value">${knew.length}</div><div class="name">✓ Knew it</div></div>
        <div class="stat"><div class="value">${revision.length}</div><div class="name">🔁 Need revision</div></div>
        <div class="stat"><div class="value">${skipped.length}</div><div class="name">Skipped</div></div>
      </div>
      ${revision.length ? `
        <p class="im-hint">Questions to revise:</p>
        <ul class="answer-points">${revision.map(q => `<li>${IPH.esc(q.question)}</li>`).join("")}</ul>` : ""}
      <div class="im-buttons">
        <button class="btn btn-accent" data-im="again" data-source="${IPH.esc(source)}" type="button">Practise again</button>
        ${revision.length ? `<button class="btn" data-im="open-revision" type="button">Open need-revision list</button>` : ""}
        <button class="btn" data-im="close" type="button">Close</button>
      </div>`;
  }

  /* ---------- Timer ---------- */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function startTimer() {
    stopTimer();
    if (!session || !session.timer) return;
    let left = session.timer;
    timerId = setInterval(() => {
      left -= 1;
      const clock = $("imClock");
      if (clock) {
        clock.textContent = formatTime(Math.max(left, 0));
        clock.classList.toggle("low", left <= 10);
      }
      if (left <= 0) reveal(true);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  /* ---------- Events ---------- */
  $("imClose").addEventListener("click", close);

  $("interviewModal").addEventListener("click", e => {
    if (e.target.id === "interviewModal") close();       // click outside the box
  });

  $("imBody").addEventListener("click", e => {
    const copy = e.target.closest('[data-action="copy"]');
    if (copy) return IPH.app.copyCode(copy.closest("[data-id]").dataset.id, copy);

    const btn = e.target.closest("[data-im]");
    if (!btn) return;
    const action = btn.dataset.im;
    if (action === "start") startFromSetup();
    else if (action === "reveal") reveal();
    else if (action === "knew" || action === "revision" || action === "skip") rate(action);
    else if (action === "again") renderSetup(btn.dataset.source);
    else if (action === "close") close();
    else if (action === "open-revision") {
      close();
      IPH.app.navigate("revision");
    }
  });

  document.addEventListener("keydown", e => {
    if ($("interviewModal").hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      return close();
    }
    if (!session) return;                                  // setup or summary screen
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;

    if (!session.revealed && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      reveal();
    } else if (session.revealed && e.key === "1") {
      rate("knew");
    } else if (session.revealed && e.key === "2") {
      rate("revision");
    } else if (e.key === "ArrowRight") {
      rate("skip");
    }
  });

  IPH.interview = { open, close };
})(window.IPH = window.IPH || {});
