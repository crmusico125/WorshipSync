# WorshipSync

WorshipSync is an offline-first desktop app for planning church services and running live projection.

It is built around a practical single-operator workflow:

1. Create or open a service
2. Build the lineup with songs, scripture, countdowns, and media
3. Choose a display and go live
4. Control the audience-facing projection from a separate operator window

The app is built with Electron, React, TypeScript, Zustand, SQLite, and Drizzle ORM.

## What It Does Today

- Service planning with upcoming/past services, readiness states, and quick access from an overview dashboard
- A service workspace that combines lineup preparation and live presentation control
- Song library with section-based lyrics, slide preview, CCLI metadata, and per-song styling
- Scripture insertion from an in-app browser directly into a service lineup
- Shared media library for images, video, and audio assets
- Theme management with global, seasonal, and per-song presentation themes
- Separate projection window for the audience display
- Multi-display detection, projection display switching, and projection window recovery hooks
- Live controls for slides, blank/logo states, countdowns, and media playback
- Service cue notes visible to the presenter
- Church name, recurring service schedule, timezone, and projection defaults in Settings
- Local analytics for song usage, rotation health, and service history
- Backup export/import using a portable `.worshipsync` file
- Stage display (confidence monitor) served over a local Wi-Fi web server — any phone, tablet, or laptop on the same network can open the URL in a browser with no app install required
- Two connection URLs for the stage display: a human-readable device-name address (e.g. `http://device-name.local:4040`) for phones and laptops, and an IP address fallback for smart TVs and devices without mDNS support

## Product Focus

WorshipSync is currently optimized for a focused church presentation workflow rather than broad production tooling.

- Offline-first local desktop app
- Designed for a small team or single operator
- Fast Sunday-morning workflow over deep broadcast integrations
- Local data ownership with SQLite storage and file-based backups

## Current Workflow

### Overview

- See the next service, library counts, display availability, and quick actions
- Jump into planning or return to an active live session

### Planner

- Create and manage service dates
- Track service status as `empty`, `in-progress`, or `ready`
- Open a service for preparation or go live from the planner

### Service Workspace

- Build and reorder a lineup
- Add songs from the library
- Add scripture passages
- Add countdowns and media items
- Edit included sections and cue notes
- Preview how slides will break before going live

### Live Presentation

- Open a dedicated projection window
- Select or move the output display
- Advance slides with keyboard controls
- Show countdowns, videos, audio, images, lyrics, or blank/logo states
- View current and next content from the operator interface

### Stage Display

- Enable a local web server from **Settings → Stage Display**
- Settings shows two URLs to share with the worship team:
  - **Device name** (e.g. `http://MacBook-Pro.local:4040`) — works on phones, tablets, and laptops on the same Wi-Fi; easier to type than an IP
  - **IP address** (e.g. `http://192.168.1.x:4040`) — fallback for smart TVs and older devices that don't support mDNS
- Any device on the same Wi-Fi network opens the URL in a browser — no app install needed
- Updates instantly as slides advance via Server-Sent Events (SSE)
- Shows: current slide lyrics (large), next slide preview (dimmed), current time, slide position, and a countdown timer when active
- Blank overlay appears when the operator blanks the screen
- Connection dot shows live status; auto-reconnects if the network drops
- Default port is 4040, configurable in Settings
- Auto-starts on app launch if it was previously enabled

### Library And Settings

- Manage songs, media assets, and themes
- Configure church name, service schedules, timezone defaults, and projection font size
- Export/import data for another machine

## Feature Breakdown

### Service Planning

- Overview dashboard with next-service summary
- Planner for future and past services
- Service edit/status management
- Recurring service schedule defaults

### Song And Scripture Content

- Song creation with section parsing via tags like `[Verse]` and `[Chorus]`
- Song metadata including artist, key, and CCLI number
- Slide generation from song sections
- Scripture browser that converts selected verses into lineup-ready slides

### Media

- Shared media library stored locally
- Image, video, and audio support
- Usage-aware delete checks before removing media
- Media insertion into services as presentable lineup items

Supported formats currently include:

- Images: `jpg`, `jpeg`, `png`, `webp`
- Video: `mp4`, `webm`, `mov`
- Audio: `mp3`, `wav`, `ogg`, `m4a`, `aac`, `flac`

### Themes And Styling

- Global themes
- Seasonal themes
- Per-song themes
- Configurable font family, size, weight, color, alignment, text position, overlay, shadow, and lines-per-slide
- Theme background assignment

### Live Projection

- Dedicated projection renderer
- Audience-facing lyrics/media output
- Blank and logo screen controls
- Countdown projection
- Video play/pause/stop and seek controls
- Audio playback support from the presenter
- Projection window lifecycle handling in Electron main/preload/renderer layers

### Stage Display

- Local HTTP server running inside the Electron main process
- Slide state is pushed to connected browsers in real time using Server-Sent Events (SSE)
- Each slide advance in the presenter sends `nextLines` and `nextSectionLabel` in the payload so the stage display can show an accurate next-slide preview
- `SlidePayload` in `shared/types.ts` carries both current and next slide data across the IPC boundary
- The served page is a self-contained HTML file embedded in the main process — no separate build step
- mDNS hostname resolved via `scutil --get LocalHostName` on macOS (falls back to `os.hostname()` on other platforms) so the `.local` address shown in Settings is the one that actually resolves
- `bonjour-service` advertises the server on the local network for service discovery

### Operations

- Local SQLite persistence
- Data export/import to a `.worshipsync` bundle
- Projection font defaults
- Church branding text on projection
- Song usage analytics and service history

## Tech Stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Electron |
| UI | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Database | SQLite + better-sqlite3 |
| ORM | Drizzle ORM |
| Packaging | electron-builder |

## Architecture

WorshipSync uses a standard Electron split with a dedicated projection renderer:

- `src/main` handles window creation, IPC, display management, file access, and SQLite persistence
- `src/preload` exposes a typed bridge to the renderer via `contextBridge`
- `src/renderer` contains the React operator UI
- `src/renderer/projection.html` + `src/renderer/src/projection.tsx` power the audience-facing projection window
- `shared/types.ts` and renderer window typings keep IPC contracts explicit

Key architectural concerns in the current app:

- Two-window desktop flow: control window + projection window
- Display enumeration and switching
- Local-first persistence
- Projection synchronization through Electron IPC
- Stage display served as a third output channel — same slide events fan out from the main process to the projection window (via IPC) and to connected stage display browsers (via SSE) simultaneously

## Project Structure

```text
src/
├── main/
│   ├── index.ts
│   └── db/
├── preload/
│   └── index.ts
├── renderer/
│   ├── index.html
│   ├── projection.html
│   └── src/
│       ├── App.tsx
│       ├── projection.tsx
│       ├── components/
│       ├── screens/
│       ├── store/
│       └── styles/
└── shared/
    └── types.ts
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run In Development

```bash
npm run dev
```

### Typecheck And Lint

```bash
npm run typecheck
npm run lint
```

### Build

```bash
npm run build
```

## Packaging

### macOS

```bash
npm run dist:mac
```

Current packaging target:

- `arm64` DMG

Output goes to `release/`.

### Windows

```bash
npm run dist:win
```

Current packaging target:

- `x64` NSIS installer

Output goes to `release/`.

## Data Storage And Backups

WorshipSync stores app data locally on the machine using SQLite and app-managed asset storage.

- Songs, services, lineup items, themes, and analytics are stored locally
- Imported backgrounds/media are copied into the app data directory
- Export creates a portable `.worshipsync` backup file containing structured data plus referenced local media

Typical migration flow:

1. Open `Settings`
2. Export a backup
3. Move the `.worshipsync` file to another machine
4. Import the backup from `Settings`

## Development Notes

- No external service is required to run the current app locally
- SongSelect is present in the UI as a future-facing placeholder, not a completed integration
- The codebase is actively evolving toward a more explicit service/presentation state model

## License

MIT
