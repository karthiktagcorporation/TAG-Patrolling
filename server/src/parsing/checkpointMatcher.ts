import stringSimilarity from "string-similarity";

export interface CheckpointMasterEntry {
  id: string;
  name: string;
  aliases: string[]; // approved aliases only
}

export type MatchType = "EXACT" | "ALIAS" | "FUZZY" | "REVIEW_REQUIRED" | "NONE";

export interface MatchResult {
  checkpointId: string | null;
  checkpointName: string | null;
  matchType: MatchType;
  confidence: number;
}

function normalizeText(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FUZZY_ACCEPT_THRESHOLD = 0.82; // auto-accept as FUZZY match
const FUZZY_REVIEW_THRESHOLD = 0.55; // below EXACT/ALIAS but above this -> REVIEW_REQUIRED

/**
 * Matches a raw checkpoint string from a PDF against the plant's master checkpoint
 * list, trying exact match, then approved alias match, then fuzzy match.
 * Anything below the fuzzy-review threshold is left unmatched (treated as EXTRA).
 */
export function matchCheckpoint(rawName: string, master: CheckpointMasterEntry[]): MatchResult {
  const normalizedRaw = normalizeText(rawName);
  if (!normalizedRaw) return { checkpointId: null, checkpointName: null, matchType: "NONE", confidence: 0 };

  // 1) Exact match against master checkpoint names
  for (const cp of master) {
    if (normalizeText(cp.name) === normalizedRaw) {
      return { checkpointId: cp.id, checkpointName: cp.name, matchType: "EXACT", confidence: 1 };
    }
  }

  // 2) Approved alias match
  for (const cp of master) {
    for (const alias of cp.aliases) {
      if (normalizeText(alias) === normalizedRaw) {
        return { checkpointId: cp.id, checkpointName: cp.name, matchType: "ALIAS", confidence: 1 };
      }
    }
  }

  // 3) Fuzzy match against master names + aliases
  const candidates: { cp: CheckpointMasterEntry; text: string }[] = [];
  for (const cp of master) {
    candidates.push({ cp, text: normalizeText(cp.name) });
    for (const alias of cp.aliases) candidates.push({ cp, text: normalizeText(alias) });
  }

  let best: { cp: CheckpointMasterEntry; score: number } | null = null;
  for (const c of candidates) {
    const score = stringSimilarity.compareTwoStrings(normalizedRaw, c.text);
    if (!best || score > best.score) best = { cp: c.cp, score };
  }

  if (best && best.score >= FUZZY_ACCEPT_THRESHOLD) {
    return { checkpointId: best.cp.id, checkpointName: best.cp.name, matchType: "FUZZY", confidence: best.score };
  }
  if (best && best.score >= FUZZY_REVIEW_THRESHOLD) {
    return { checkpointId: best.cp.id, checkpointName: best.cp.name, matchType: "REVIEW_REQUIRED", confidence: best.score };
  }

  return { checkpointId: null, checkpointName: null, matchType: "NONE", confidence: best?.score ?? 0 };
}
