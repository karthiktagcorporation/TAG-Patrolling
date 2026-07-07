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

interface RoundDef {
  label: string;
  startTime: string; // HH:mm
  order: number;
}

function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Finds the nearest round window for a given time-of-day, honoring the plant tolerance. */
function findNearestRound(timeHHmmss: string, rounds: RoundDef[], toleranceMinutes: number): RoundDef | null {
  const [h, m] = timeHHmmss.split(":").map(Number);
  const t = h * 60 + m;

  let best: { round: RoundDef; diff: number } | null = null;
  for (const r of rounds) {
    const rMin = minutesFromMidnight(r.startTime);
    // handle overnight wraparound (23:00 round vs 00:30 record etc.) using 1440-based circular distance
    let diff = Math.abs(t - rMin);
    diff = Math.min(diff, 1440 - diff);
    if (!best || diff < best.diff) best = { round: r, diff };
  }
  if (best && best.diff <= toleranceMinutes) return best.round;
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

  const rounds: RoundDef[] = plant.roundSchedules
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ label: r.label, startTime: r.startTime, order: r.order }));

  const tolerance = plant.toleranceMinutes;
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
        confidence: null
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
        confidence: match.confidence
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
        confidence: match.confidence
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
        confidence: match.confidence
      });
      continue;
    }

    const round = findNearestRound(normTime.time!, rounds, tolerance);
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
        confidence: match.confidence
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
        confidence: match.confidence
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
      confidence: match.confidence
    });
  }

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
          ...parsedRecords
            .filter((r) => r.status === "MALFUNCTION")
            .map((r) => ({ category: "MALFUNCTION", message: "Unparseable line", detail: r.rawLine })),
          ...parsedRecords
            .filter((r) => r.status === "OUT_OF_TIME")
            .map((r) => ({ category: "OUT_OF_TIME", message: `"${r.normalizedCheckpoint}" punched outside round tolerance`, detail: r.rawLine }))
        ]
      }
    },
    include: { parsedRecords: true, issues: true }
  });

  return report;
}
