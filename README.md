# InterviewPrep Hub

A fast, offline-friendly interview preparation app for backend developers. It covers 760+ questions and answers on Python, FastAPI, Django, SQL, PostgreSQL, Redis, Celery, testing, GenAI/RAG, PHP, JavaScript, HTML/CSS, AWS, Docker, system design and more.

It is built with plain **HTML5, CSS3 and JavaScript (ES6+)**, with no framework and no build step. All your progress is stored in your browser with **LocalStorage**.

## Features

| Feature | What it does |
|---|---|
| **Q&A cards** | Answer, key points as bullets, and example code with syntax colours and a Copy button |
| **Dashboard** | Overall progress, stats and a tile per subject with its own progress bar |
| **Subject navigation** | Sidebar grouped by topic (Python & Web, Databases, Cloud & DevOps, …), with a subject search |
| **Search** | Searches questions, answers, key points and code. Every word must match, and matches are highlighted. Press `/` to focus it. |
| **Filters** | By level (Beginner / Intermediate / Advanced) and status (completed, not completed, important, need revision, has notes) |
| **Progress tracking** | ✓ Done, ★ Important and 🔁 Need revision on every question |
| **Notes** | Your own notes per question, saved automatically |
| **Interview mode** | Random questions, optional timer, reveal the answer, then rate yourself (*I knew it* / *Need revision*). It ends with a summary. |
| **Theme** | Dark and light themes, remembered between visits |
| **Local progress** | Everything is saved in LocalStorage. You can export or import a JSON backup to move progress to another browser. |
| **Deep links** | The URL remembers the view (`#/subject/FastAPI`, `#/important`, …), so refresh and Back work |
| **PWA** | Installable on desktop and phone, works offline after the first visit, shows an update banner for new versions |

## Run it

**Option 1: open the file.** Double-click `index.html`. The app loads the questions from `data/questions.bundle.js`. Offline mode and installing need http(s), so they don't work from a file.

**Option 2: run a local server (recommended while editing data).** The app then reads `data/*.json` directly:

```bash
cd interview-prep-hub
python -m http.server 8000
# open http://localhost:8000
```

You can also use the VS Code *Live Server* extension.

## Install it as an app (PWA)

InterviewPrep Hub is a **Progressive Web App**. Open the hosted site once, and it works **offline** and can be installed like a normal app:

| Device | How to install |
|---|---|
| **Chrome / Edge (Windows, Mac, Linux)** | Click **⬇ Install app** in the sidebar, or the install icon in the address bar |
| **Android (Chrome)** | Menu ⋮ → **Install app** / **Add to Home screen** |
| **iPhone / iPad (Safari)** | Share button → **Add to Home Screen** |

- **Offline:** the service worker caches the app, all styles, scripts, question files and icons on the first visit. After that the app opens without internet.
- **Updates:** when you push changes, the app picks them up on the next visit. If the service worker itself changed, a **"New version available → Refresh"** banner appears.
- **Your progress stays on each device** (LocalStorage). To continue on another device, use **Export progress** on one and **Import progress** on the other.

## Host it on GitHub Pages

1. Create an **empty public repository** on GitHub named `interview-prep-hub` (no README, no license).
2. Push this folder:

```bash
git init -b main
git add .
git commit -m "InterviewPrep Hub: first version"
git remote add origin https://github.com/<your-username>/interview-prep-hub.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
4. After a minute or two the site is live at **https://&lt;your-username&gt;.github.io/interview-prep-hub/**.

To publish changes later: edit, then `git add . && git commit -m "..." && git push`. Pages redeploys automatically.

All paths are relative (`./`), so the app works under the `/interview-prep-hub/` sub-path. `.nojekyll` tells GitHub Pages to serve the files as they are.

### When you change the file list

`service-worker.js` has a `FILES_TO_CACHE` list. If you **add, rename or delete** a CSS, JS, JSON or icon file, update the list **and** bump `CACHE_VERSION` (for example `"v1"` → `"v2"`), so installed apps download the new files. Editing the *content* of existing files doesn't need a version bump.

## Project structure

```
interview-prep-hub/
├── index.html                 # app shell
├── manifest.json              # PWA: name, icons, colours, start URL
├── service-worker.js          # PWA: offline cache
├── .nojekyll                  # GitHub Pages: serve files as-is
├── css/
│   ├── style.css              # layout and components
│   ├── dark-theme.css         # dark colour variables
│   └── light-theme.css        # light colour variables
├── js/
│   ├── app.js                 # routing, sidebar, dashboard, cards, export/import
│   ├── questions.js           # data loading, subject groups, code-language detection
│   ├── search.js              # search + highlighting
│   ├── filters.js             # level / status filters
│   ├── progress.js            # done / important / need-revision (LocalStorage)
│   ├── interview-mode.js      # interview practice
│   ├── notes.js               # notes per question (LocalStorage)
│   ├── pwa.js                 # install button, update banner, offline notices
│   └── theme.js               # dark / light theme
├── data/
│   ├── *.json                 # public questions, one file per topic
│   ├── questions.bundle.js    # generated: used when opening index.html from disk
│   └── private/               # NOT in git: personal questions (see "Private questions")
├── tools/
│   └── build-bundle.py        # validates data/*.json and rebuilds the bundle
├── assets/
│   ├── icons/                 # favicon.svg, icon-192/512.png, maskable + apple-touch icons
│   └── screenshots/
├── README.md
├── LICENSE
└── .gitignore
```

## Question format

Each file in `data/` is a JSON array of questions:

```json
{
  "id": "python-3f9a1c2b",
  "subject": "Python",
  "level": "Beginner",
  "question": "What is a generator?",
  "answer": "A generator is a function that uses yield ...",
  "points": ["yield = pause and return a value", "Lazy, low memory"],
  "code": "def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1",
  "memory": "Remember: yield = pause and give",
  "tip": "Show the memory difference with a list."
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique and stable. Progress and notes are saved by ID, so don't change it after people have used the question. |
| `subject` | yes | Shown in the sidebar. Add new subjects to a group in `js/questions.js` (`IPH.GROUPS`), or they appear under **Other**. |
| `level` | no | `Beginner`, `Intermediate`, `Advanced` or empty. Levels were set automatically at first, so edit them as you like. |
| `question`, `answer` | yes | Plain text. HTML is escaped. |
| `points` | no | Key points, shown as bullets. `"Term = meaning"` and `"Term: meaning"` are shown as **Term** – meaning. |
| `code` | no | Example code. The language is detected automatically; add `"language": "sql"` (or `python`, `bash`, `yaml`, …) to override it. |
| `memory`, `tip` | no | Kept in the data (memory line and interview tip), not shown on the cards. |

### Private questions

Personal questions (your introduction, resume story, salary expectation, HR answers) live in **`data/private/`**, for example `data/private/about-me.json`. This folder is in `.gitignore`, so it is **never committed or published**.

- The app loads private files **only when it runs on your own computer**: `localhost` / `127.0.0.1`, or `index.html` opened from disk. The public GitHub Pages site never requests them.
- List private file names in `IPH.PRIVATE_DATA_FILES` in `js/questions.js`.
- `python tools/build-bundle.py` also builds `data/private/private.bundle.js` (also ignored by git) for opening the app from disk.
- Back up `data/private/` yourself (for example to a private cloud folder), because it is not on GitHub.

### Adding or editing questions

1. Edit a file in `data/` (or add a new one and list it in `IPH.DATA_FILES` in `js/questions.js`).
2. Rebuild the bundle so that opening `index.html` from disk also shows your changes:

```bash
python tools/build-bundle.py
```

The script checks the data for missing fields, duplicate IDs and invalid levels before writing.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the search box |
| `Esc` | Clear search / close interview mode |
| `Space` | Interview mode: show the answer |
| `1` / `2` | Interview mode: *I knew it* / *Need revision* |
| `→` | Interview mode: skip |

## Where your data is stored

Progress, notes, theme and collapsed sidebar groups are saved in your browser's LocalStorage (keys starting with `iph.`). Clearing site data or using a private window starts fresh, so use **Export progress** in the sidebar to keep a backup.

## License

[MIT](LICENSE)
