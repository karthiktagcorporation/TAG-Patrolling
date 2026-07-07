# HANDOVER

## Architecture summary

```
Browser (React SPA) --/api--> Express server --Prisma--> SQLite (prisma/dev.db)
                                    |
                                    +--> pdf-parse (raw text extraction)
                                    +--> parsing/* (normalize time + checkpoint)
                                    +--> services/validationEngine.ts (scoring)
```

- `server/src/parsing/pdfParser.ts` — extracts raw text and splits it into
  candidate patrol-record lines.
- `server/src/parsing/timeNormalizer.ts` — turns any supported raw time
  string into `HH:mm:ss` (+ date if present).
- `server/src/parsing/checkpointMatcher.ts` — matches a raw checkpoint
  string to the plant's master checkpoint list (exact / alias / fuzzy).
- `server/src/services/validationEngine.ts` — orchestrates parsing +
  matching + round-window assignment + duplicate detection + scoring, and
  persists a `ValidationReport` with its `ParsedRecord`s and
  `ValidationIssue`s.

## Critical discovery: real PDF text layout

The most important thing to know before touching the parser: **pdf-parse
does not extract these PDFs as clean left-to-right table rows.** It
extracts them column-by-column, so each visual row becomes one text line
with the columns in *reversed order and glued together with no spaces*:

```
16-06-2026 22:00:140C03-25200894High voltage1
└─ Patrol Time ─┘└─ Reader Code ─┘└Checkpoint┘└NO
```

This was discovered by uploading the real attached sample PDFs through the
running app and inspecting `ValidationReport.rawText` — it does **not**
match what a PDF viewer displays. Any future change to the parser should
be verified the same way (upload a real sample, fetch
`/api/reports/:id`, inspect `rawText` and `parsedRecords`) rather than
assumed from how the PDF looks visually.

The parser handles both this flattened layout and a more conventional
whitespace/tab-separated layout (in case a future export changes format),
by trying both strategies per line.

## Route-order (sequence) validation (added 2026-07-07)

Each plant's checkpoints have a stored `order` (the route order from the
Excel master). Within each round, `validationEngine.ts` walks that round's
VALID/ALIAS_MATCHED punches in the order they appear in the source PDF and
tracks the highest checkpoint order seen so far; if a punch's order is
lower than that running maximum, it's flagged `outOfSequence: true` and an
`OUT_OF_SEQUENCE` issue row is added.

This is deliberately **informational only** — it does not change a punch's
VALID/ALIAS_MATCHED status or subtract from `validAchieved`. The written
spec asks to "detect" out-of-sequence checkpoints as one of several
detection categories, alongside missing/duplicate/extra, not to make route
order a scoring gate. If route order should become a hard requirement
(e.g. an out-of-order punch should not count toward achievement), change
the status assignment in the sequence-check loop in
`server/src/services/validationEngine.ts` rather than the achievement
formula itself.

## Round schedule model (updated 2026-07-07)

`RoundSchedule` rows are still just `{label, startTime, order}` per plant —
nothing plant-specific was hardcoded into the engine. The two schedule
families (30-min/13-round vs 40-min/10-round) are pure seed data, generated
in `server/src/seed.ts` by `generateRoundTimes(intervalMinutes, count)`
starting from 23:00. `findNearestRound`'s circular-distance calculation
(handles the 23:00-to-05:00 midnight crossover) was already generic and
required no changes for the new schedules.

If a plant ever needs a *third* schedule shape (e.g. STK's day-shift
sample — see limitation below), it's just a matter of adding more
`RoundSchedule` rows via the Plant Master UI or seed script; no engine
change needed.

## Sample PDF test results (verified via API upload, 2026-07-07)

**Original run (7 rounds / old targets, 2026-07-07 morning):**

| Plant | Target | Valid | Achieved% | Missing | Dup | Extra | Out-of-time | Notes |
|---|---|---|---|---|---|---|---|---|
| TAG 1A | 28 | 28 | 100% | 0 | 0 | 0 | 8 | Baseline clean sample; 22:00/06:00 rounds correctly excluded (outside the 7 official rounds) |
| TAG 3 | 49 | 49 | 100% | 0 | 0 | 0 | 14 | Confirms mm/dd/yyyy + AM/PM time parsing works |
| TAG 4 | 28 | 19 | 67.9% | 9 | 2 | 0 | 3 | "Vibration dambar Welding shed" alias resolves correctly; some rounds only have 2 of 3 checkpoints in the sample, hence missing |
| SSVF | 21 | 14 | 66.7% | 0 | 6 | 4 | — | "CYLINDER AREA" correctly flagged EXTRA, not silently counted as COOLING TOWER |
| STK | 21 | 0 | 0% | 21 | 0 | 8 | 24 | Sample is a **daytime** shift file (round times ~07:00-14:00); see limitation below |
| TAG 2 | 77 | 67 | 87% | 10 | 12 | 6 | 17 | "Before Utility Building" correctly flagged EXTRA |

TAG 1B was not re-tested after the parser rewrite in this session but uses
the identical parsing path as TAG 1A/3/4, which all passed.

**Re-run after the Excel master update (13/10-round schedules, new
targets, 2026-07-07 later):** these same sample PDFs were captured under
the *old* round frequency (hourly, not half-hourly/40-min) and the *old*
TAG 2 checkpoint list, so lower match rates here are expected — they
reflect stale sample data against the new stricter master, not a parser
regression. Verified mechanics: round-window matching against both new
interval families, round-wise summary math, and target math (rounds x
checkpoints) all correct.

| Plant | Target | Valid | Achieved% | Missing | Dup | Extra | Out-of-time | Out-of-sequence |
|---|---|---|---|---|---|---|---|---|
| TAG 1A | 52 | 28 | 53.9% | 24 | 0 | 0 | 8 | 0 |
| TAG 2 | 80 | 55 | 68.75% | 25 | 7 | 26 | 14 | 10 |
| TAG 4 | 40 | 21 | 52.5% | 19 | 0 | 0 | 3 | 13 |

TAG 1A's result above is the clean, easy-to-verify case: the sample only
punches once per hour, so it fills exactly the 7 on-the-hour rounds
(23:00, 00:00, 01:00 ... 05:00) out of the new 13 half-hourly rounds and
is correctly MISSING on the 6 half-hour rounds (23:30, 00:30, etc.) — spot
checked via `roundSummaryJson` and confirmed exact (4/4 achieved on every
on-the-hour round, 0/4 on every half-hour round).

## Known limitations / assumptions

1. **STK day-shift schedule.** The attached STK sample filename is
   `STK 16 June 26 DAY.pdf` and its punches cluster around 07:00-14:00,
   not the 23:00-05:00 night pattern seeded for every plant. Nothing in
   the written requirement described a separate day schedule, so STK was
   seeded with the same 7 night rounds as every other plant (safest
   assumption: consistent schedule unless told otherwise). If STK also
   runs a day shift in practice, add a second `RoundSchedule` set (or a
   `shift` field) via the Plant Master screen — the validation engine
   already generically supports arbitrary round definitions.
2. **Checkpoint names ending in a digit.** Because the row's serial number
   is glued directly onto the checkpoint name with no separator in the
   flattened PDF layout, a checkpoint name that itself ends in a digit
   (e.g. hypothetically "AREA 1") can lose that trailing digit when the
   PDF has many rows (10+) causing a multi-digit serial to be
   ambiguous. None of the 21 seeded checkpoints across all 7 plants end in
   a digit, so this has not caused a real mismatch, but it is worth
   knowing if new checkpoints are added later.
3. **Guard names.** All 7 sample PDFs leave the Guard column blank, so
   `ParsedRecord.guard` is always `null` today. The parsing path exists
   and will populate automatically once a PDF export includes guard names
   — no code change needed on that front unless the column layout differs
   from the reader-code+name+serial pattern documented above.
4. **Fuzzy threshold.** `checkpointMatcher.ts` uses 0.82 similarity to
   auto-accept a fuzzy match and 0.55 to flag REVIEW_REQUIRED (below 0.55
   is EXTRA/unmapped). These two thresholds are the main knob if
   over/under-matching is reported in production; they are not currently
   exposed in Settings (code-level constant), intentionally, since
   getting this wrong silently miscounts valid achievement — change it in
   `server/src/parsing/checkpointMatcher.ts` and redeploy rather than via
   the UI.
5. **Sessions are in-memory.** `express-session`'s default MemoryStore is
   used. This is fine for a single-process internal tool but means all
   users are logged out on every server restart/deploy, and it won't
   scale horizontally. If that becomes a problem, swap in
   `connect-sqlite3` or similar (the `AppSetting`/Prisma wiring is already
   in place to add a session table if desired).

6. **Real logo asset not embedded in the repo.** The logo image the user
   shares in chat is a pasted/inline image, not a file path on disk, and
   there is no tool available in this environment to extract that pasted
   image's bytes to a file. `TagLogo.tsx` was built to prefer
   `client/public/tag-logo.png` automatically (falling back to an SVG
   recreation if that file is absent, which it currently is) so this is a
   pure drop-in, zero-code-change fix — see "manual follow-up" below.

## What needs manual follow-up

- **Save the real logo file.** Export/save the TAG logo image (the one
  shown in the chat) as a PNG/SVG and place it at
  `client/public/tag-logo.png`. No code or restart needed — the component
  already prefers this path and falls back to the SVG recreation only
  when the file is missing. Aspect ratio is preserved automatically
  (only `height` is set in CSS; `width` is always `auto`).
- **STK day-shift round schedule** (see limitation #1) if that shift
  pattern is actually used in production for STK.
- **Old sample PDFs vs new master**: the 7 attached sample PDFs were
  captured under the previous round frequency/checkpoint lists (see the
  "Sample PDF test results" re-run table above). They still exercise the
  parser correctly but will show more MISSING/EXTRA now that the master
  reflects the stricter Excel-driven schedule — this is expected, not a
  regression, until fresh samples matching the new 13/10-round cadence are
  captured.
