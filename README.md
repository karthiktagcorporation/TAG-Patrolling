# TAG-Patrolling

Internal web application that verifies security patrol completion for TAG plants
against planned checkpoint routes and round timings. Guards carry handheld
readers whose nightly logs are exported as PDF; this app ingests those PDFs,
normalizes messy real-world formatting, matches punches against each plant's
checkpoint master, and produces an auditable, printable achievement report.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma ORM + SQLite (`prisma/dev.db`)
- **Auth**: single shared password + server-side session (cookie), auto-timeout
- **File upload**: multer (PDF only, 20MB limit)
- **PDF text extraction**: pdf-parse
- **Fuzzy checkpoint matching**: string-similarity (Dice coefficient)

## Project layout

```
client/    React app (pages, components, API client)
server/    Express API, PDF parsing pipeline, validation engine
prisma/    schema.prisma + migrations + seed data (via server/src/seed.ts)
docs/      nginx config sample for deployment
scripts/   Hostinger deployment helper script
```

## Local setup

```powershell
npm run install:all          # installs root, server, client deps
copy .env.example server\.env
npm run prisma:migrate       # creates prisma/dev.db and applies schema
npm run prisma:seed          # seeds the 7 plants + checkpoints + rounds
npm run dev                  # runs server (port 4000) + client (port 5173) together
```

Open http://localhost:5173, log in with the password from `server/.env`
(`APP_PASSWORD`, default `Tag@2026`).

## Production build

```powershell
npm run build                 # builds server (dist/) and client (dist/)
npm start                     # runs the Express server, which also serves client/dist
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Hostinger VPS runbook and
[HANDOVER.md](HANDOVER.md) for architecture/assumption notes and known
limitations discovered while testing against real sample PDFs.

## Password & session

- Login password is set via `APP_PASSWORD` in `server/.env` (see `.env.example`).
- Sessions are server-side (`express-session`, in-memory store) with an
  idle-timeout controlled by `SESSION_TIMEOUT_MINUTES`.
- Logout is available in the sidebar on every authenticated page.

## Logo

`client/src/components/TagLogo.tsx` renders `client/public/tag-logo.png` if
present (only `height` is ever set in CSS, `width` is always `auto`, so the
image's own natural aspect ratio is preserved everywhere it's used — login,
sidebar header, and the print/PDF letterhead — with no distortion). If that
file is missing, it falls back to an accurate SVG recreation of the mark so
the app still renders correctly out of the box.

**To use the real logo file**: save it as `client/public/tag-logo.png`
(any resolution — it's scaled by height only) and it is picked up
automatically, no code change needed. The current file was extracted from
the official `TAG-logo-andColors.pdf` brand sheet (natural size 946×514).

## Uploading patrol PDFs

The Upload page accepts **multiple PDFs at once**. For each file the plant
and patrol date are detected automatically from the filename — e.g.
`TAG 1 A 16 June 26.pdf` → TAG 1A / 2026-06-16, `TAG FOUR 06 June 26.pdf`
→ TAG 4 / 2026-06-06. If a filename has no date, the page's "Fallback
Patrol Date" is used. Detection logic lives in
`server/src/parsing/plantFromFilename.ts`.

## Plant master data (route patterns, round schedules, targets)

Source of truth: `PUNCHING STATIONS - Copy for GM.xlsx` (2026-07-07 update),
transcribed into `server/src/seed.ts`. Two round-schedule families are used,
both starting at 23:00 (Round 1, per the business rule that 11:00 PM is
always the first round):

| Plants | Interval | Rounds | Checkpoints | Target |
|---|---|---|---|---|
| TAG 1A, TAG 1B, TAG 3, STK, SSVF | 30 min | 13 (23:00→05:00) | 4 / 4 / 7 / 3 / 3 | 52 / 52 / 91 / 39 / 39 |
| TAG 2, TAG 4 | 40 min | 10 (23:00→05:00) | 8 / 4 | 80 / 40 |

Target count = rounds × checkpoints in every case. Route order (used for
out-of-sequence detection) is the checkpoint list order above, editable per
plant in Plant Master. See [PROGRESS.md](PROGRESS.md) for the full checkpoint
lists and [HANDOVER.md](HANDOVER.md) for the route-order validation logic.
