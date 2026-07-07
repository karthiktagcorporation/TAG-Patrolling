# PROGRESS

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
