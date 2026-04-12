# WorshipSync

Church worship presentation app — a free, open-source alternative to EasyWorship and ProPresenter built specifically for our church's workflow.

## Features

- **Song library** — section-based lyrics (verse, chorus, bridge, etc.) with inline creation and section editor
- **Service planner** — weekly lineup builder with drag-and-drop reordering, today detection, and quick launch
- **Live presenter** — dual-screen operator panel + audience display with blank, logo, and slide controls
- **Slide theming** — global, seasonal, and per-song themes with custom backgrounds (images or solid colors)
- **Per-song backgrounds** — assign different backgrounds to each song in a lineup
- **Data backup** — export/import all app data (songs, services, backgrounds) as a `.worshipsync` file for moving to another machine
- **Analytics** — song usage history and frequency tracking

## Tech stack

| Layer         | Choice                                | Why                             |
| ------------- | ------------------------------------- | ------------------------------- |
| Desktop shell | Electron                              | Cross-platform, two-window IPC  |
| UI            | React + Vite + TypeScript             | Fast dev, type safety           |
| Styling       | Tailwind CSS + CSS variables          | Utility-first, consistent       |
| State         | Zustand                               | Lightweight, no boilerplate     |
| Database      | SQLite + better-sqlite3 + Drizzle ORM | Local, offline, fast            |
| Packaging     | electron-builder                      | DMG (macOS), NSIS installer (Windows) |

## Getting started

```bash
# Install dependencies
npm install

# Run in development (opens both windows)
npm run dev

# Type-check and lint
npm run typecheck
npm run lint
```

## Packaging

### macOS (DMG)

```bash
npm run dist:mac
```

Outputs to `release/`:
- `WorshipSync-x.x.x-arm64.dmg` — Apple Silicon (M1/M2/M3)
- `WorshipSync-x.x.x.dmg` — Intel

> **First launch on another Mac:** macOS will show an "unidentified developer" warning because the app is not notarized. Right-click the app → **Open** → **Open** to bypass it once.

### Windows (NSIS installer)

```bash
npm run dist:win
```

Outputs a standard `.exe` installer to `release/`.

## Moving data to another machine

1. Open WorshipSync → **Settings** tab
2. Click **Export backup** — saves a `.worshipsync` file containing all songs, services, themes, and background images
3. On the new machine, open WorshipSync → **Settings** → **Import backup** and select the file

## Project structure

```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.ts    # Window creation, IPC handlers
│   └── db/         # SQLite schema, migrations, Drizzle ORM
├── preload/        # contextBridge API exposed to renderer
├── shared/         # Types shared across processes
└── renderer/       # React UI (Chromium)
    ├── index.html          # Control window entry
    ├── projection.html     # Projection window entry
    └── src/
        ├── App.tsx                  # Shell + navigation
        ├── projection.tsx           # Projection React root
        ├── screens/                 # One file per screen
        ├── components/              # Shared UI components
        ├── store/                   # Zustand stores
        └── styles/
            └── globals.css
```

## Environment variables

Create a `.env` file in the project root (never commit this):

```env
ANTHROPIC_API_KEY=sk-ant-...
```

## License

MIT
