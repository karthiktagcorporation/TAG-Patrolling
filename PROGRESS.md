# PROGRESS

## 2026-07-11 — Dashboard totals + plants-uploaded count + SSVF→TAG 5

1. **"Total Plants" card → "Plants Uploaded"**: now shows the number of
   distinct plants that actually have uploaded reports (upload 3 plant files →
   3), computed via a `distinct: ["plantId"]` query in the dashboard endpoint,
   not the master plant count.
2. **Recent Validations totals row** added: sums Target, Valid, Missing,
   Duplicate, Extra and Out-of-Time across the listed uploads, with a combined
   Achieved % = total valid / total target. Dashboard `recent` take raised
   10 → 50 so the totals cover all of today's uploads.
3. **Plant SSVF renamed to TAG 5**: renamed the existing plant record in place
   (history preserved) and updated `seed.ts`. "SSVF" kept as a filename alias
   in `plantFromFilename.ts` so old `SSVF ....pdf` exports still auto-route to
   TAG 5. Verified: SSVF-named file → TAG 5, totals math correct.

## 2026-07-08 (3) — Checkpoint renames + dashboard columns/print

1. **Checkpoint renames** (seed updated + reseeded, history preserved):
   - TAG 1B: "RUBBER MOLDING GATE" → "RUBBER MOLDING ENTRANCE"
     (aliases now: "RUBBER MOLDING", "RUBBER MOLDING GATE" → the sample PDF's
     "RUBBER MOLDING" still matches).
   - TAG 3: "SECURITY ROOM" → "SECURITY" (alias "SECURITY ROOM" kept for the
     old spelling; the sample PDF's "SECURITY" now matches EXACT instead of
     REVIEW_REQUIRED).
   - TAG 2: "Near Temple outside S1" → "Near Temple outside S 1".
   Verified: TAG 1B and TAG 3 samples validate with 0 EXTRA after the rename.
2. **Dashboard "Recent Validations" now shows per-plant Target, Valid,
   Missing, Extra and Out-of-Time** columns (the report objects already
   carried these fields — no backend change needed).
3. **Dashboard Print / Save PDF** button added (uses the same browser-print
   path as the report page), with a print-only TAG letterhead and the
   action buttons + the row "View" links hidden via `.no-print`.

## 2026-07-08 (later) — Round-window assignment fix + history reset

Four fixes based on live feedback:

1. **Round 1 only after 11:00 PM.** Round assignment is now anchored at 23:00.
   Every punch time is measured as "minutes since 23:00" (wrapping past
   midnight), so any punch before 23:00 (e.g. the 22:00–22:04 pre-shift
   punches in the TAG 1A sample) falls outside every round window and is
   classified `OUT_OF_TIME` instead of being counted as Round 1. Verified.
2. **Rounds follow the time pattern strictly.** Replaced the old
   nearest-time (`findNearestRound`, ±tolerance) matching with contiguous,
   forward **time windows** built directly from each plant's round schedule:
   round N owns `[its start, the next round's start)`, last round is one
   interval wide. No tolerance knob involved (matches the earlier removal of
   the Tolerance UI).
3. **Reset option for Dashboard & History.** New `DELETE /api/history/reset`
   clears all reports + parsed records + issues (Plant Master untouched), with
   a confirm-guarded "Reset Data" button on both the Dashboard and History
   pages. Verified (deleted 17 old reports; dashboard went to empty).
4. **Round 9 / Round 10 same-interval split fixed.** This was the visible
   symptom of the nearest-time matcher: punches a few minutes apart within one
   physical round (e.g. 03:13 and 03:17) were split across Round 9 (03:00) and
   Round 10 (03:30) because 03:17 was nearer to 03:30. Forward windows keep the
   whole visit together — verified: 03:03–03:06 TAG 1A punches all land in
   Round 9, and TAG 4's 40-min schedule maps cleanly across its 10 rounds.

Engine change is confined to `server/src/services/validationEngine.ts`
(`minutesFromAnchor` / `buildRoundWindows` / `assignRoundByWindow` replace
`minutesFromMidnight` / `findNearestRound`). No schema change, no reseed.

## 2026-07-08 — UI/UX simplification + real logo + multi-plant upload

Follow-up change requests against the running app:

1. **Real TAG logo installed.** Extracted the official mark from
   `TAG-logo-andColors.pdf` (rendered at 300dpi via Poppler `pdftoppm`,
   cropped tight with Pillow) and saved it to `client/public/tag-logo.png`
   (946×514). `TagLogo.tsx` already prefers this file with **height-only**
   CSS sizing (`width:auto`), so it now shows the real logo at its natural
   aspect ratio everywhere (login, sidebar, print letterhead) with zero
   distortion. Brand colors in `tailwind.config.cjs` updated to the exact
   values from the brand sheet: red `#cb3127`, grey `#727071`.
2. **Removed "Tolerance (min)"** from the Plant Master list and the
   per-plant editor (`Plants.tsx`, `PlantDetail.tsx`). The `toleranceMinutes`
   DB column and the engine's use of it are untouched (default 30) — only
   the UI controls were removed, so nothing needs a migration.
3. **Removed Session Timeout** control — it lived only on the now-removed
   Settings page. Idle timeout still works from `SESSION_TIMEOUT_MINUTES`
   in `server/.env` (default 30 min).
4. **Removed the Settings page entirely** (`Settings.tsx` deleted, nav link
   and route removed from `Layout.tsx`/`App.tsx`). The inert `/api/settings`
   backend route was left in place (harmless, unused).
5. **Multi-file PDF upload with automatic plant detection.** The upload page
   now accepts multiple PDFs at once; the plant and patrol date are derived
   from each filename (new `server/src/parsing/plantFromFilename.ts`,
   handling both digit and word forms — "TAG 1 A", "TAG ONE A", "TAG FOUR",
   "STK", "SSVF" — and "16 June 26" style dates). `/api/reports/upload` now
   takes `files[]` and returns one result row per file so a bad filename
   doesn't fail the batch. Verified end-to-end: 3 mixed files each detected
   the correct plant + date.

## 2026-07-07 (later) — Excel-driven master data update

Source: `PUNCHING STATIONS - Copy for GM.xlsx`. This was an **update**, not a
rebuild — existing `ValidationReport`/`ParsedRecord`/`ValidationIssue`
history is untouched and remains viewable in History.

- **Prisma migration** `20260707171314_route_order_and_round_schedule_v2`
  (additive only, no data loss): added `ParsedRecord.outOfSequence`
  (Boolean, default false) and `ValidationReport.outOfSequenceCount` (Int,
  default 0) + `ValidationReport.roundSummaryJson` (String, nullable).
  Existing rows backfilled with the defaults automatically.
- **Reseed required and performed** (`npm run prisma:seed`): all 7 plants'
  checkpoints and round schedules were fully replaced with the new
  Excel-driven values (old Checkpoint/RoundSchedule rows deleted and
  recreated per plant — safe because ParsedRecord/ValidationReport store
  their own copy of checkpoint names as text and have no DB foreign key to
  Checkpoint, so old reports still display correctly even though the
  Checkpoint rows they once matched no longer exist).
- **New round schedule model**: two interval families, both starting at
  23:00 as Round 1 — 30-minute/13-round (TAG 1A, TAG 1B, TAG 3, STK, SSVF)
  and 40-minute/10-round (TAG 2, TAG 4). Round times wrap past midnight
  correctly (existing circular-distance logic in
  `findNearestRound` already handled this, unchanged).
- **New/changed target counts**: TAG 1A 28→52, TAG 1B 28→52, TAG 2 77→80,
  TAG 3 49→91, TAG 4 28→40, STK 21→39, SSVF 21→39. All equal
  rounds × checkpoints.
- **TAG 2 route changed**: now 8 checkpoints (Material Gate, Shed 3
  Compound Wall, Before Utility Building, Irrigation Well, S2 A Corner,
  Remaining Material Area, Near Temple outside S1, Office Gate) — note
  "Before Utility Building" is now an official master checkpoint (it was
  previously flagged EXTRA against the old 11-checkpoint list). Four old
  checkpoints (S2 Tool Room, S2 Forging Section, Waiting For Forging, S1
  inside Opposite to temple) were dropped from the route.
- **Route-order (sequence) validation added**: within each round, punches
  are checked against the master's configured checkpoint order (the
  `Checkpoint.order` field, already existed, now also drives this). A
  punch whose route-order regresses relative to the highest order already
  seen in that round is flagged `outOfSequence: true` on the `ParsedRecord`
  and generates an `OUT_OF_SEQUENCE` issue row. **This is additive/
  informational only** — it does not change VALID/ALIAS_MATCHED status or
  achieved-count scoring, since the spec asked to "detect" out-of-sequence
  punches, not exclude them from achievement. See
  `server/src/services/validationEngine.ts`.
- **Round-wise validation summary added**: `ValidationReport.roundSummaryJson`
  stores, per round, the expected vs. achieved checkpoint list in route
  order — computed once at validation time and persisted so reprinting a
  saved report from History shows the same summary without re-parsing.
- **UI updates**: Plant Master now shows route-order numbers on each
  checkpoint plus a Route checkpoints / Round count / Target summary strip;
  Report Result now has an `OUT_OF_SEQUENCE` filter chip, a Sequence column
  ("OUT OF ORDER" badge) in the detailed records table, and a new
  "Round-wise Validation Summary" section.
- **Logo**: `TagLogo.tsx` rewritten to prefer a real image file at
  `client/public/tag-logo.png` (only `height` is set in CSS, `width` stays
  `auto`, so aspect ratio is always preserved — no distortion possible),
  falling back to the existing SVG recreation via `<img onError>` if the
  file isn't present yet (it isn't, in this repo — see "manual follow-up"
  below). Added a print-only branded letterhead (logo + plant + date) to
  the Report Result print/PDF output, which previously had no logo at all
  since the sidebar (where the only logo was) is hidden via `.no-print`
  when printing.
- **Retested against real sample PDFs** with the new schedule (see
  HANDOVER.md for the updated table): round-window matching, round-wise
  summary, and target math all confirmed correct against the new 13-round
  and 10-round schedules. Old samples now show more MISSING/EXTRA than
  before, which is expected — they were captured under the old
  hourly/7-round and 11-checkpoint assumptions, not a parser regression.

### Files changed in this update

- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `server/src/seed.ts` (fully rewritten)
- `server/src/services/validationEngine.ts` (sequence + round-summary logic)
- `server/src/routes/plants.ts` (order-by added to checkpoint/round queries)
- `client/src/pages/PlantDetail.tsx`, `client/src/pages/ReportView.tsx`
- `client/src/components/TagLogo.tsx`, `client/src/index.css`
- `README.md`, `PROGRESS.md`, `HANDOVER.md`

### Reseed / migration required for anyone else running this app

Anyone with an existing local/deployed database must run, in order:
```
npm run prisma:migrate --prefix server   # applies the new columns
npm run prisma:seed --prefix server      # replaces route/round/target data
```
History is preserved; only Plant Master (checkpoints/rounds/targets) is
replaced.

## 2026-07-07 — Initial build

- Scaffolded full-stack project: `client/` (Vite+React+TS+Tailwind),
  `server/` (Express+TS), `prisma/` (SQLite schema + migration + seed).
- Implemented password-gate login with server-side session, logout, and
  configurable idle session timeout.
- Prisma schema created and migrated: Plant, Checkpoint, CheckpointAlias,
  RoundSchedule, ValidationReport, ParsedRecord, ValidationIssue, AppSetting.
- Seeded all 7 plants (TAG 1A, TAG 1B, TAG 2, TAG 3, TAG 4, STK, SSVF) with
  their checkpoints, 7 nightly round schedules (23:00-05:00), targets, and
  the two aliases explicitly called out in the requirement (TAG 1B "RUBBER
  MOLDING" and TAG 4 "Vibration dambar Welding shed").
- Built the parsing pipeline:
  - `timeNormalizer.ts` — handles dd-mm-yyyy 24h, mm/dd/yyyy with AM/PM,
    and compact OCR-flattened digit strings.
  - `checkpointMatcher.ts` — exact -> approved alias -> fuzzy (Dice
    coefficient) -> REVIEW_REQUIRED -> EXTRA, per spec.
  - `pdfParser.ts` — **rewritten after real-sample testing**: pdf-parse
    extracts these specific table PDFs column-by-column, producing lines
    with columns in *reversed order and no whitespace between them*
    (e.g. `16-06-2026 22:00:140C03-25200894High voltage1`). The parser
    strips the time token, then a reader-code token of the fixed shape
    `AA00-NNNNNNNN` (8 digits), then a trailing serial-number digit run,
    to recover the checkpoint name. Verified against all 7 attached
    sample PDFs (see below).
- Built the validation engine: expected-plan generation (rounds x
  checkpoints), round-window matching with tolerance, duplicate detection
  (first-valid-wins), scoring, and issue-row generation for all 8 required
  categories.
- Built all required frontend pages: Login, Dashboard, Plant Master
  (+ per-plant checkpoint/alias/round editor), PDF Upload, Validation
  Result (with filters, debug raw-parse panel, mandatory-remarks
  print/PDF modal), History (with plant/date/status filters), Settings.
- Verified end-to-end against all 7 attached real sample PDFs via direct
  API calls (curl multipart upload) — see HANDOVER.md "Sample PDF test
  results" for the numbers and what each one proves.
- Verified in-browser: login, dashboard, navigation, Tailwind styling all
  render correctly (Vite dev server + Express API via proxy).
- docs: README.md, HANDOVER.md, DEPLOYMENT.md, .env.example,
  ecosystem.config.js, docs/nginx/tag-patrolling.conf,
  scripts/deploy-hostinger.sh all created.

### Known limitations / follow-ups (see HANDOVER.md for detail)

- STK's sample PDF is a **daytime** shift log (round times ~07:00-14:00),
  while the seeded round schedule for STK is the standard night pattern
  (23:00-05:00) used for all other plants. Every punch in that sample is
  therefore OUT_OF_TIME against the current master — this is a data/master
  mismatch, not a parser defect (confirmed by inspecting raw parsed
  records). Plant Master already supports editing round schedules per
  plant if a day-shift schedule needs to be added for STK.
- Checkpoint names that end in a digit (e.g. a hypothetical "SHED 1") can
  lose that trailing digit when parsing the flattened PDF layout, because
  the row's own serial number is glued on with no separator. This did not
  affect any of the 7 seeded checkpoint lists (none end in a digit) but is
  worth knowing if new checkpoints are added.
- Guard name column is not populated in any of the sample PDFs (blank in
  source), so `ParsedRecord.guard` is currently always null in practice;
  the field and parsing path exist and will populate automatically if a
  future export includes guard names.
- Git repository not yet initialized in this session — see HANDOVER.md for
  the exact next command needed (GitHub auth may be required).
