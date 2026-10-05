/* Question data: loading, subject groups, sorting and code-language detection. */
(function (IPH) {
  "use strict";

  // Public files in data/ (without .json). Add a new file here when you create one.
  IPH.DATA_FILES = [
    "python", "fastapi", "django", "sql", "postgresql", "redis",
    "testing", "genai", "php", "javascript", "cloud-devops", "architecture"
  ];

  // Private files in data/private/ (kept out of git, never published).
  // They are only loaded when the app runs on your own computer.
  IPH.PRIVATE_DATA_FILES = ["about-me"];
  IPH.LOAD_PRIVATE_DATA = location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  // Sidebar groups. Subjects not listed here appear under "Other".
  IPH.GROUPS = [
    { name: "About Me", subjects: ["Introduction", "My Resume", "My Projects", "HR"] },
    { name: "Python & Web", subjects: ["Python", "Python Programs", "FastAPI", "Django", "SQLAlchemy", "REST API", "Testing"] },
    { name: "GenAI", subjects: ["GenAI / LLM"] },
    { name: "PHP & Frontend", subjects: ["PHP", "PHP Programs", "JavaScript", "HTML & CSS"] },
    { name: "Databases", subjects: ["SQL", "MySQL", "PostgreSQL", "Redis"] },
    { name: "Cloud & DevOps", subjects: ["AWS", "AWS Lambda", "Docker/CI-CD", "Monitoring", "Git", "Linux", "Tools"] },
    { name: "Architecture", subjects: ["Design Patterns", "Microservices", "System Design", "Scenario", "Process"] }
  ];

  const LEVELS = ["Beginner", "Intermediate", "Advanced"];

  let all = [];
  let bySubjectMap = new Map();

  /* ---------- Helpers shared by other files ---------- */
  IPH.esc = function (value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* ---------- Loading ---------- */
  // Over http(s) the JSON files are the source of truth.
  // Opened from disk (file://) the browser blocks fetch(), so data/questions.bundle.js is used.
  async function load() {
    let items = null;

    if (location.protocol !== "file:") {
      try {
        const lists = await Promise.all(IPH.DATA_FILES.map(name =>
          fetch(`data/${name}.json`, { cache: "no-cache" }).then(res => {
            if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
            return res.json();
          })
        ));
        items = lists.flat();
      } catch (e) {
        console.warn("Could not load data/*.json, using the bundle instead:", e);
      }
    }

    if (!items) {
      if (!window.IPH_BUNDLE) {
        try { await loadScript("data/questions.bundle.js"); } catch (e) { /* reported below */ }
      }
      if (window.IPH_BUNDLE) items = IPH.DATA_FILES.flatMap(name => window.IPH_BUNDLE[name] || []);
    }
    if (!items || !items.length) {
      throw new Error("No question data found. Run a local server or rebuild data/questions.bundle.js.");
    }

    if (IPH.LOAD_PRIVATE_DATA) items = [...(await loadPrivate()), ...items];

    all = items.map(normalize);
    bySubjectMap = new Map();
    all.forEach(q => {
      if (!bySubjectMap.has(q.subject)) bySubjectMap.set(q.subject, []);
      bySubjectMap.get(q.subject).push(q);
    });
    return all;
  }

  // Private questions (data/private/*.json). Missing files are simply skipped.
  async function loadPrivate() {
    if (location.protocol !== "file:") {
      const lists = await Promise.all(IPH.PRIVATE_DATA_FILES.map(name =>
        fetch(`data/private/${name}.json`, { cache: "no-cache" })
          .then(res => (res.ok ? res.json() : []))
          .catch(() => [])
      ));
      return lists.flat();
    }
    if (!window.IPH_PRIVATE_BUNDLE) {
      try { await loadScript("data/private/private.bundle.js"); } catch (e) { return []; }
    }
    return IPH.PRIVATE_DATA_FILES.flatMap(name => (window.IPH_PRIVATE_BUNDLE || {})[name] || []);
  }

  // The bundle (~800 KB) is only loaded when it is needed, e.g. when index.html is opened from disk.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(script);
    });
  }

  function normalize(q) {
    const points = Array.isArray(q.points)
      ? q.points
      : String(q.points || "").split("|").filter(p => p.trim());
    const code = q.code || "";
    return {
      id: q.id,
      subject: q.subject,
      level: LEVELS.includes(q.level) ? q.level : "",
      question: q.question,
      answer: q.answer || "",
      points,
      code,
      language: code ? (q.language || guessLang(q.subject, code)) : "",
      memory: q.memory || "",
      tip: q.tip || ""
    };
  }

  /* ---------- Subjects and groups ---------- */
  function groups() {
    const listed = new Set(IPH.GROUPS.flatMap(g => g.subjects));
    const known = IPH.GROUPS
      .map(g => ({ name: g.name, subjects: g.subjects.filter(s => bySubjectMap.has(s)) }))
      .filter(g => g.subjects.length);
    const other = [...bySubjectMap.keys()].filter(s => !listed.has(s));
    return other.length ? [...known, { name: "Other", subjects: other }] : known;
  }

  function subjects() {
    return groups().flatMap(g => g.subjects);
  }

  // Inside one subject: numbered lessons / programs first, then theory, then "Coding:" questions.
  function bySubject(subject) {
    const list = bySubjectMap.get(subject) || [];
    const stepNo = q => Number((q.question.match(/^(?:Lesson|Program) (\d+):/) || [])[1]);
    const rank = q => (stepNo(q) ? 0 : q.question.startsWith("Coding:") ? 2 : 1);
    const steps = list.filter(q => rank(q) === 0).sort((a, b) => stepNo(a) - stepNo(b));
    return [...steps, ...list.filter(q => rank(q) === 1), ...list.filter(q => rank(q) === 2)];
  }

  function getAll() {
    return all;
  }

  function byId(id) {
    return all.find(q => q.id === id);
  }

  /* ---------- Code language detection ---------- */
  IPH.LANG_LABEL = {
    python: "Python", sql: "SQL", php: "PHP", javascript: "JavaScript", yaml: "YAML",
    bash: "Bash", dockerfile: "Dockerfile", json: "JSON", nginx: "Nginx",
    html: "HTML", css: "CSS", http: "HTTP", plaintext: "Text"
  };
  // highlight.js language names (and languages not in its default bundle)
  IPH.HLJS_CLASS = { nginx: "plaintext", html: "xml", http: "plaintext" };

  function guessLang(subject, code) {
    const t = code.trimStart();
    const looksPython = /^\s*(def |class |import |from [\w.]+ import )/m.test(t);
    if (t.startsWith("<?php") || subject.startsWith("PHP")) return "php";
    if (subject === "JavaScript" || /^\/\/|\bpm\.(test|expect|response)/.test(t)) return "javascript";
    if (/^(server|location\s+\S+)\s*\{/m.test(t)) return "nginx";
    if (/^<(?!\?php)/.test(t)) return "html";
    if (!looksPython && /^(GET|POST|PUT|PATCH|DELETE)\s+\//m.test(t)) return "http";
    if (subject === "HTML & CSS") return "css";
    if (/^(FROM|RUN|COPY|CMD|WORKDIR)\b/.test(t.replace(/^#.*\n/gm, ""))) return "dockerfile";
    if (!looksPython && /^(services|jobs|on|name|groups|global|version|image|definitions|pipelines|AWSTemplateFormatVersion|Resources|scrape_configs):/m.test(t)) return "yaml";
    if (!looksPython && /^\s*(--|(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|BEGIN|START TRANSACTION|WITH|EXPLAIN|SHOW)\b)/.test(t)) return "sql";
    if (["SQL", "MySQL", "PostgreSQL"].includes(subject) && !looksPython) return "sql";
    if (!looksPython && /^\s*[{[]/.test(t)) {
      try { JSON.parse(t); return "json"; } catch (e) { /* not JSON */ }
    }
    if (!looksPython && /^(#!|pip |python |python3 |aws |docker |celery |sam |git |redis-cli|curl |sudo |npm |uvicorn |gunicorn |kubectl |mkdir |export |newrelic-admin |opentelemetry|locust |pytest |zip |chmod |ssh |scp |ls |cat |tail |grep |systemctl )/m.test(t)) return "bash";
    if (["Linux", "Git", "Docker/CI-CD"].includes(subject)) return "bash";
    return "python";
  }

  IPH.questions = { load, getAll, byId, bySubject, groups, subjects, LEVELS };
})(window.IPH = window.IPH || {});
