# WorshipSync

Church worship presentation app — a free, open-source alternative to EasyWorship and ProPresenter built specifically for our church's workflow.

## Features

- 📖 Song library with section-based lyrics (verse, chorus, bridge...)
- 🗓️ Drag-and-drop weekly service lineup builder
- 🖥️ Live dual-screen presenter — operator panel + audience display
- 🎬 Image, video, and Bible verse support
- 🎨 Slide theming with global, seasonal, and per-song themes
- 📊 Song usage history and analytics
- 🤖 AI-powered song suggestions, lyric import, Bible verse search
- 🎛️ Elgato Stream Deck integration

## Tech stack

| Layer         | Choice                                | Why                             |
| ------------- | ------------------------------------- | ------------------------------- |
| Desktop shell | Electron                              | Cross-platform, two-window IPC  |
| UI            | React + Vite + TypeScript             | Fast dev, type safety           |
| Styling       | Tailwind CSS                          | Utility-first, consistent       |
| State         | Zustand                               | Lightweight, no boilerplate     |
| Database      | SQLite + better-sqlite3 + Drizzle ORM | Local, offline, fast            |
| Packaging     | Electron Forge                        | .exe / .dmg / .deb              |
| CI            | GitHub Actions                        | Auto-build on push              |
| AI            | Anthropic Claude API                  | Song suggestions, lyric parsing |

## Getting started

```bash
# Install dependencies
npm install

# Run in development (opens both windows)
npm run dev

# Build for production
npm run build

# Package as installer
npm run make
```

## Project structure

```
src/
├── main/           # Electron main process (Node.js)
│   └── index.ts   # Window creation, IPC handlers, lifecycle
├── preload/        # Secure contextBridge API exposed to renderer
│   └── index.ts
├── shared/         # Types used across both processes
│   └── types.ts
└── renderer/       # React UI (runs in Chromium)
    ├── index.html          # Control window entry
    ├── projection.html     # Projection window entry
    └── src/
        ├── App.tsx                  # Shell + navigation
        ├── projection.tsx           # Projection React root
        ├── screens/                 # One file per screen
        ├── components/              # Shared UI components
        ├── store/                   # Zustand state (Commit 2+)
        ├── db/                      # Database layer (Commit 2)
        └── styles/
            └── globals.css
```

## Commit roadmap

| Commit   | What ships                                                             |
| -------- | ---------------------------------------------------------------------- |
| **1** ✅ | Project scaffold — Electron dual-window, React, TypeScript, IPC bridge |
| **2**    | Database schema — SQLite + Drizzle, seed data                          |
| **3**    | Song library UI — browse, search, song detail                          |
| **4**    | Song CRUD + AI lyric import                                            |
| **5**    | Service builder — calendar, lineup, section toggles                    |
| **6**    | Live presenter — operator panel, projection, keyboard shortcuts        |
| **7**    | Stream Deck integration — Elgato SDK, auto-layout from lineup          |
| **8**    | Themes + Analytics                                                     |
| **9**    | AI features — song suggester, rotation advisor, Bible verse search     |

## Environment variables

Create a `.env` file in the project root (never commit this):

```env
ANTHROPIC_API_KEY=sk-ant-...
```

## License

MIT
