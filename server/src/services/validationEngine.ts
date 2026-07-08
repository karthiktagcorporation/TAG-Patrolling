import dayjs from "dayjs";
import { prisma } from "./prisma";
import { parseLinesFromText } from "../parsing/pdfParser";
import { normalizeTime } from "../parsing/timeNormalizer";
import { matchCheckpoint, CheckpointMasterEntry } from "../parsing/checkpointMatcher";

export type IssueCategory =
  | "VALID"
  | "MISSING"
  | "DUPLICATE"
  | "EXTRA"
  | "MALFUNCTION"
  | "OUT_OF_TIME"
  | "ALIAS_MATCHED"
  | "REVIEW_REQUIRED";

export interface RoundSummaryCheckpoint {
  checkpointId: string;
  name: string;
  order: number;
  status: "VALID" | "ALIAS_MATCHED" | "MISSING";
}

export interface RoundSummary {
  label: string;
  startTime: string;
  expectedCount: number;
  achievedCount: number;
  checkpoints: RoundSummaryCheckpoint[];
}

interface RoundDef {
  label: string;
  startTime: string; // HH:mm
  order: number;
}

// The nightly patrol is anchored at 23:00 (11:00 PM) = Round 1. Every time is
// measured as "minutes elapsed since 23:00", wrapping past midnight, so the whole
// shift maps to a simple increasing scale: 23:00->0, 23:30->30, 00:00->60,
// 03:00->240, 05:00->360, etc. A time before 23:00 wraps to a large value
// (e.g. 22:00 -> 1380) and therefore falls outside every round window — which is
// exactly the rule "Round 1 is only ever after 11:00 PM".
const SHIFT_ANCHOR_MIN = 23 * 60;

function minutesFromAnchor(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h * 60 + m) - SHIFT_ANCHOR_MIN + 1440) % 1440;
}

interface RoundWindow {
  round: RoundDef;
  start: number; // minutes from 23:00 anchor (inclusive)
  end: number; // minutes from anchor (exclusive)
}

/**
 * Builds contiguous, forward-looking time windows straight from the plant's round
 * schedule. Each round owns the half-open interval [its start, the next round's
 * start); the last round's window is one interval wide. Because guards punch a
 * round AT or AFTER its scheduled time (never before), forward windows keep every
 * punch of one physical round together — fixing the bug where punches a few minutes
 * apart (e.g. 03:13 and 03:17) were split across Round 9 (03:00) and Round 10 (03:30)
 * by nearest-time matching.
 */
function buildRoundWindows(rounds: RoundDef[]): RoundWindow[] {
  const offsets = rounds.map((r) => ({ round: r, offset: minutesFromAnchor(r.startTime) }));
  offsets.sort((a, b) => a.offset - b.offset);
  return offsets.map((o, i) => {
    const next = i < offsets.length - 1 ? offsets[i + 1].offset : o.offset + (o.offset - (offsets[i - 1]?.offset ?? o.offset - 30));
    return { round: o.round, start: o.offset, end: next };
  });
}

/** Assigns a time strictly to the round window it falls in, or null if outside all windows. */
function assignRoundByWindow(timeHHmmss: string, windows: RoundWindow[]): RoundDef | null {
  const p = minutesFromAnchor(timeHHmmss);
  for (const w of windows) {
    if (p >= w.start && p < w.end) return w.round;
  }
  return null;
}

export async function runValidation(params: {
  plantId: string;
  patrolDate: string;
  fileName: string;
  rawText: string;
}) {
  const plant = await prisma.plant.findUniqueOrThrow({
    where: { id: params.plantId },
    include: { checkpoints: { include: { aliases: true } }, roundSchedules: true }
  });

  const master: CheckpointMasterEntry[] = plant.checkpoints.map((c) => ({
    id: c.id,
    name: c.name,
    aliases: c.aliases.filter((a) => a.approved).map((a) => a.alias)
  }));
  const checkpointOrderMap = new Map(plant.checkpoints.map((c) => [c.id, c.order]));
  const checkpointsInOrder = plant.checkpoints.slice().sort((a, b) => a.order - b.order);

  const rounds: RoundDef[] = plant.roundSchedules
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ label: r.label, startTime: r.startTime, order: r.order }));

  const roundWindows = buildRoundWindows(rounds);
  const rawLines = parseLinesFromText(params.rawText);

  const seenRoundCheckpoint = new Set<string>(); // `${roundLabel}::${checkpointId}` for duplicate detection

  const parsedRecords: {
    lineNumber: number;
    rawLine: string;
    guard: string | null;
    rawCheckpoint: string | null;
    normalizedCheckpoint: string | null;
    matchedCheckpointId: string | null;
    matchType: string | null;
    rawTime: string | null;
    normalizedTime: string | null;
    matchedRound: string | null;
    status: IssueCategory;
    confidence: number | null;
    outOfSequence: boolean;
  }[] = [];

  for (const line of rawLines) {
    if (!line.checkpoint) {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: null,
        normalizedCheckpoint: null,
        matchedCheckpointId: null,
        matchType: null,
        rawTime: line.timeToken,
        normalizedTime: null,
        matchedRound: null,
        status: "MALFUNCTION",
        confidence: null,
        outOfSequence: false
      });
      continue;
    }

    const normTime = normalizeTime(line.timeToken ?? "");
    const match = matchCheckpoint(line.checkpoint, master);

    if (!normTime.ok) {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: line.checkpoint,
        normalizedCheckpoint: match.checkpointName,
        matchedCheckpointId: match.checkpointId,
        matchType: match.matchType,
        rawTime: line.timeToken,
        normalizedTime: null,
        matchedRound: null,
        status: "MALFUNCTION",
        confidence: match.confidence,
        outOfSequence: false
      });
      continue;
    }

    if (match.matchType === "NONE") {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: line.checkpoint,
        normalizedCheckpoint: null,
        matchedCheckpointId: null,
        matchType: "NONE",
        rawTime: line.timeToken,
        normalizedTime: normTime.time,
        matchedRound: null,
        status: "EXTRA",
        confidence: match.confidence,
        outOfSequence: false
      });
      continue;
    }

    if (match.matchType === "REVIEW_REQUIRED") {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: line.checkpoint,
        normalizedCheckpoint: match.checkpointName,
        matchedCheckpointId: match.checkpointId,
        matchType: "REVIEW_REQUIRED",
        rawTime: line.timeToken,
        normalizedTime: normTime.time,
        matchedRound: null,
        status: "REVIEW_REQUIRED",
        confidence: match.confidence,
        outOfSequence: false
      });
      continue;
    }

    const round = assignRoundByWindow(normTime.time!, roundWindows);
    if (!round) {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: line.checkpoint,
        normalizedCheckpoint: match.checkpointName,
        matchedCheckpointId: match.checkpointId,
        matchType: match.matchType,
        rawTime: line.timeToken,
        normalizedTime: normTime.time,
        matchedRound: null,
        status: "OUT_OF_TIME",
        confidence: match.confidence,
        outOfSequence: false
      });
      continue;
    }

    const key = `${round.label}::${match.checkpointId}`;
    if (seenRoundCheckpoint.has(key)) {
      parsedRecords.push({
        lineNumber: line.lineNumber,
        rawLine: line.rawLine,
        guard: line.guard,
        rawCheckpoint: line.checkpoint,
        normalizedCheckpoint: match.checkpointName,
        matchedCheckpointId: match.checkpointId,
        matchType: match.matchType,
        rawTime: line.timeToken,
        normalizedTime: normTime.time,
        matchedRound: round.label,
        status: "DUPLICATE",
        confidence: match.confidence,
        outOfSequence: false
      });
      continue;
    }

    seenRoundCheckpoint.add(key);
    parsedRecords.push({
      lineNumber: line.lineNumber,
      rawLine: line.rawLine,
      guard: line.guard,
      rawCheckpoint: line.checkpoint,
      normalizedCheckpoint: match.checkpointName,
      matchedCheckpointId: match.checkpointId,
      matchType: match.matchType,
      rawTime: line.timeToken,
      normalizedTime: normTime.time,
      matchedRound: round.label,
      status: match.matchType === "EXACT" ? "VALID" : "ALIAS_MATCHED",
      confidence: match.confidence,
      outOfSequence: false
    });
  }

  // Route-order validation: within each round, checkpoints must be punched in the
  // master's configured route order. Walk each round's valid punches in the order
  // they were parsed (== chronological order in the source PDF) and flag any punch
  // whose checkpoint order regresses relative to the highest order seen so far in
  // that round. This is additive/informational — it does not change VALID/
  // ALIAS_MATCHED status or the achieved-count scoring, only flags the record and
  // adds a reviewable issue row, since the written spec only asks to "detect"
  // out-of-sequence punches, not exclude them from achievement.
  const recordsByRound = new Map<string, typeof parsedRecords>();
  for (const r of parsedRecords) {
    if ((r.status === "VALID" || r.status === "ALIAS_MATCHED") && r.matchedRound) {
      if (!recordsByRound.has(r.matchedRound)) recordsByRound.set(r.matchedRound, []);
      recordsByRound.get(r.matchedRound)!.push(r);
    }
  }
  const sequenceIssueDetails: { message: string; detail?: string }[] = [];
  for (const [roundLabel, recs] of recordsByRound) {
    let maxOrderSeen = -1;
    for (const r of recs) {
      const order = checkpointOrderMap.get(r.matchedCheckpointId!) ?? 0;
      if (order < maxOrderSeen) {
        r.outOfSequence = true;
        sequenceIssueDetails.push({
          message: `Out-of-sequence punch in ${roundLabel}: "${r.normalizedCheckpoint}" (expected after a later route checkpoint)`,
          detail: r.rawLine
        });
      } else {
        maxOrderSeen = order;
      }
    }
  }
  const outOfSequenceCount = sequenceIssueDetails.length;

  const validAchieved = parsedRecords.filter((r) => r.status === "VALID" || r.status === "ALIAS_MATCHED").length;
  const plannedTarget = plant.targetCount;
  const achievedPercent = plannedTarget > 0 ? Math.round((validAchieved / plannedTarget) * 10000) / 100 : 0;

  const duplicateCount = parsedRecords.filter((r) => r.status === "DUPLICATE").length;
  const extraCount = parsedRecords.filter((r) => r.status === "EXTRA").length;
  const malfunctionCount = parsedRecords.filter((r) => r.status === "MALFUNCTION").length;
  const outOfTimeCount = parsedRecords.filter((r) => r.status === "OUT_OF_TIME").length;
  const reviewCount = parsedRecords.filter((r) => r.status === "REVIEW_REQUIRED").length;

  const missingCombos: string[] = [];
  for (const cp of master) {
    for (const r of rounds) {
      const key = `${r.label}::${cp.id}`;
      if (!seenRoundCheckpoint.has(key)) {
        missingCombos.push(`${cp.name} @ ${r.label}`);
      }
    }
  }
  const missingCount = missingCombos.length;

  // Round-wise validation summary: expected vs achieved checkpoints per round,
  // in route order, for display in the UI and for reprinting saved reports later.
  const roundSummary: RoundSummary[] = rounds.map((r) => {
    const checkpoints: RoundSummaryCheckpoint[] = checkpointsInOrder.map((cp) => {
      const key = `${r.label}::${cp.id}`;
      const achieved = seenRoundCheckpoint.has(key);
      const rec = achieved
        ? parsedRecords.find((pr) => pr.matchedCheckpointId === cp.id && pr.matchedRound === r.label)
        : undefined;
      return {
        checkpointId: cp.id,
        name: cp.name,
        order: cp.order,
        status: achieved ? ((rec?.status as "VALID" | "ALIAS_MATCHED") ?? "VALID") : "MISSING"
      };
    });
    return {
      label: r.label,
      startTime: r.startTime,
      expectedCount: master.length,
      achievedCount: checkpoints.filter((c) => c.status !== "MISSING").length,
      checkpoints
    };
  });

  const report = await prisma.validationReport.create({
    data: {
      plantId: plant.id,
      patrolDate: params.patrolDate,
      fileName: params.fileName,
      rawText: params.rawText,
      plannedTarget,
      validAchieved,
      achievedPercent,
      missingCount,
      duplicateCount,
      extraCount,
      malfunctionCount,
      reviewCount,
      outOfTimeCount,
      outOfSequenceCount,
      roundSummaryJson: JSON.stringify(roundSummary),
      parsedRecords: { create: parsedRecords },
      issues: {
        create: [
          ...missingCombos.map((m) => ({ category: "MISSING", message: `Missing punch: ${m}` })),
          ...parsedRecords
            .filter((r) => r.status === "EXTRA")
            .map((r) => ({ category: "EXTRA", message: `Unmapped checkpoint: "${r.rawCheckpoint}"`, detail: r.rawLine })),
          ...parsedRecords
            .filter((r) => r.status === "REVIEW_REQUIRED")
            .map((r) => ({
              category: "REVIEW_REQUIRED",
              message: `Possible alias for "${r.normalizedCheckpoint}" (confidence ${(r.confidence ?? 0).toFixed(2)}): "${r.rawCheckpoint}"`,
              detail: r.rawLine
            })),
          ...parsedRecords
            .filter((r) => r.status === "DUPLICATE")
            .map((r) => ({ category: "DUPLICATE", message: `Duplicate punch at ${r.matchedRound}: "${r.normalizedCheckpoint}"`, detail: r.rawLine })),
          ...sequenceIssueDetails.map((s) => ({ category: "OUT_OF_SEQUENCE", message: s.message, detail: s.detail })),
          ...parsedRecords
            .filter((r) => r.status === "MALFUNCTION")
            .map((r) => ({ category: "MALFUNCTION", message: "Unparseable line", detail: r.rawLine })),
          ...parsedRecords
            .filter((r) => r.status === "OUT_OF_TIME")
            .map((r) => ({ category: "OUT_OF_TIME", message: `"${r.normalizedCheckpoint}" punched outside all round time windows (before 23:00 or after the last round)`, detail: r.rawLine }))
        ]
      }
    },
    include: { parsedRecords: true, issues: true }
  });

  return report;
}
