# Photo Tools

A web app that unifies two classic Windows image tools — **Photo Resizer** and
**Photo Converter (ICO)** — behind a single modern interface.

```
Browser ──► Next.js frontend (BFF proxy) ──► Node.js backend ──► EXE engines
                localhost:3000                    :4000         PhotoResizer.exe
                                                               PhotoConverter.exe
```

The original Photo Resizer and Modern ICO Converter applications were rebuilt
with command-line interfaces (same Pillow processing logic), so the backend can
drive them as processing engines.

## Features

- **Photo Resizer** — resize by physical size (cm) with DPI or by pixels, with
  presets for Passport / Visa / Email / LinkedIn. Output: JPG, PNG, BMP, TIFF.
- **Photo Converter** — turn images into multi-size `.ico` icons (16–256 px).
- **Video Studio** — compress MP4 / MOV / WebM / MKV videos to an exact target
  size or a chosen CRF quality, trim and change playback speed, and control
  resolution and audio (keep / strip / bitrate). Also exports animated **GIFs**
  and single-frame **thumbnails**. Powered by a host-installed FFmpeg, with live
  encode progress.
- **PDF tools** — convert to Word, merge, split, export pages as JPG, and a
  built-in **editor**: reorder / rotate / delete pages, add text, overlay images,
  freehand draw and highlight, and edit document metadata (title, author,
  subject, keywords). Edits are applied by `PhotoPdf.exe` via PyMuPDF.
- Multi-file drag-and-drop upload with live progress, per-file download and a
  combined "Download all" ZIP.
- **Accounts** — sign up / log in; processing endpoints are gated behind a
  signed-in session (sessions stored hashed in SQLite, passwords hashed with
  scrypt). Disable with `AUTH_ENABLED=false`.
- Dark/light theme, mobile-responsive UI.
- Job queue with persistence: jobs survive restarts, statuses are polled live.

## Architecture

| Piece | Tech | Notes |
| --- | --- | --- |
| Frontend | Next.js 15, React 19, Tailwind | Serves the UI; BFF proxy hides the API key |
| Backend | Express + TypeScript | Job manager, uploads, downloads, rate limiting, auth |
| Processing | PhotoResizer.exe / PhotoConverter.exe … | Restricted registry — only these paths can spawn |
| Video | System FFmpeg (ffmpeg/ffprobe) | Auto-detected on PATH or via env; optional |
| Job store | SQLite (local, zero-setup) → PostgreSQL | Swap via `DATABASE_URL` |
| Queue | In-process (local, zero-setup) → BullMQ + Redis | Swap via `REDIS_URL` |

## Prerequisites

- Node.js ≥ 20 (developed on 26)
- Windows (the processing engines are Windows executables)
- Python 3.13 + Pillow + PyInstaller — only to (re)build the EXEs
- FFmpeg (with ffprobe) on `PATH` — only for video compression; not bundled

## Quick start

```powershell
# 1. Build the processing engines (one-time). Requires Python + PyInstaller.
cd bin-src
pyinstaller --onefile --console --name PhotoResizer photo_resizer_cli.py
pyinstaller --onefile --console --name PhotoConverter photo_converter_cli.py
#   -> produces bin/PhotoResizer.exe and bin/PhotoConverter.exe

# 2. Configure environment.
Copy-Item .env.example .env        # set the two EXE paths for your machine
Copy-Item frontend/.env.example frontend/.env.local

# 3. Install and run the backend (default http://localhost:4000).
cd backend
npm install
npm run dev                         # or: npm run build && npm start

# 4. Install and run the frontend (default http://localhost:3000).
cd frontend
npm install
npm run dev                         # or: npm run build && npm start
```

Open http://localhost:3000.

## Configuration

All configuration lives in `photo-tools/.env` (see `.env.example` for
descriptions). Key items:

- `PHOTO_RESIZER_EXE` / `PHOTO_CONVERTER_EXE` — absolute paths to the engines.
- `AUTH_ENABLED` (default `true`) — require a signed-in session to process
  images. Set to `false` to run open. `AUTH_STORE` (`sqlite` | `memory`),
  `SESSION_TTL_DAYS` (default 7). A demo account is created on first startup:
  `demo@pic.tools` / `password123` (override with `DEFAULT_USER_EMAIL` /
  `DEFAULT_USER_PASSWORD`).

- Engine paths — `PHOTO_RESIZER_EXE`, `PHOTO_CONVERTER_EXE` and
  `PHOTO_ENHANCER_EXE` must point to the built CLI executables in `bin/`
  (defaults assume `bin/`). Rebuild after editing `bin-src/*.py` with
  `python -m PyInstaller <Name>.spec` in `bin-src/`, then copy the output
  from `bin-src/dist/` into `bin/`.
- `PHOTO_FFMPEG_EXE` / `PHOTO_FFPROBE_EXE` — override the auto-detected FFmpeg
  binaries used for video compression (or `FFMPEG_PATH` / `FFPROBE_PATH`).
  `MAX_VIDEO_FILE_SIZE_MB` (default 500) and `VIDEO_PROCESS_TIMEOUT_SECONDS`
  (default 1800) tune the video tool.
- `API_KEYS` — enable bearer-token auth. The frontend supplies the key
  server-side via `frontend/.env.local` → `API_KEY`.
- `FRONTEND_ORIGINS` — allowed browser origins for direct backend access.
- `REDIS_URL` / `DATABASE_URL` — switch to BullMQ + PostgreSQL for production.

## Scripts

Backend (`backend/`): `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`.
Frontend (`frontend/`): `npm run dev`, `npm run build`, `npm start`, `npm run lint`.

## Security notes

- Only the registered EXE paths (and the auto-detected FFmpeg binaries) can be
  spawned; arguments are passed as an
  array (no shell), with timeout and process-tree kill on failure.
- File type is validated by magic bytes; internal filenames are generated, never
  user-controlled; uploads are rate-limited and size-capped.
- PDF edit plans are re-validated server-side: overlay asset names must be bare
  filenames (no path separators or `..`), coordinates are clamped, and page,
  overlay and text counts are capped.
- Errors are user-friendly only — internals are never leaked.
- Old jobs (files + records) are swept automatically after `JOB_RETENTION_MINUTES`.

## Deployment

See [docs/windows-deployment.md](docs/windows-deployment.md) for running the
stack on Windows Server/IIS or behind Nginx, and for the PostgreSQL/Redis
production upgrade path.
