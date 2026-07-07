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
(`APP_PASSWORD`, default `Tag%tpm$26`).

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

`client/src/components/TagLogo.tsx` is a same-size SVG/CSS placeholder that
reproduces the reference mark (grey T/G, red A with white arrow, red/grey
"POWER TO PEOPLE" wordmark). To use the real artwork, drop a same-height
image at `client/public/tag-logo.png` and swap the `<svg>` block for an
`<img src="/tag-logo.png" style={{ height }} />`.
