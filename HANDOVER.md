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

## Sample PDF test results (verified via API upload, 2026-07-07)

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

## What needs manual follow-up

- **Git / GitHub push**: not yet done in this session. See the exact next
  command in the final summary message. If GitHub requires
  authentication (SSH key or PAT) that isn't already configured on this
  machine, that step will need to be completed manually — Claude will
  stop and report the exact command needed at that point.
- **Real TAG logo artwork**: currently an SVG/CSS placeholder built to
  match the reference screenshot exactly (same red/grey palette, same
  layout). Swap in real artwork per the instructions in `README.md` /
  `Settings` page whenever the source file is available.
- **STK day-shift round schedule** (see limitation #1) if that shift
  pattern is actually used in production for STK.
