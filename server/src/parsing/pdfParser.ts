import pdfParse from "pdf-parse";
import { extractTimeToken } from "./timeNormalizer";

export interface RawParsedLine {
  lineNumber: number;
  rawLine: string;
  guard: string | null;
  checkpoint: string | null;
  timeToken: string | null;
}

/** Extracts raw text from a PDF buffer. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

const HEADER_KEYWORDS = ["NO", "GUARD", "CHECKPOINT", "READER CODE", "PATROL TIME", "S.NO", "SNO"];

function isHeaderOrJunkLine(line: string): boolean {
  const upper = line.toUpperCase().trim();
  if (!upper) return true;
  const hits = HEADER_KEYWORDS.filter((k) => upper.includes(k)).length;
  return hits >= 2;
}

// Reader codes look like "0C03-25200894": 2-8 alnum chars, a dash, then exactly 8 digits.
// The digit count is fixed (rather than "4+") because in the flattened layout the
// reader code's digits sit directly against the checkpoint name with no separator
// (e.g. "...251001​24100 Ton Weigh bridge3" for checkpoint "100 Ton Weigh bridge") —
// a greedy digit count would eat into a checkpoint name that itself starts with digits.
const READER_CODE_AT_START = /^[A-Za-z0-9]{2,8}-\d{8}/;

/**
 * Splits extracted PDF text into candidate patrol record lines and does a
 * best-effort split into guard / checkpoint / time-token columns.
 *
 * pdf-parse extracts these patrol PDFs column-by-column rather than row-by-row,
 * so each visual table row collapses into a single text line with columns in
 * REVERSED order and NO separating whitespace between adjacent columns, e.g.:
 *   "16-06-2026 22:00:140C03-25200894High voltage1"
 * which is Patrol Time + Reader Code + Checkpoint Name + Guard(blank) + NO.
 * This is exactly the "flattened/OCR-like" reality described in the spec, so
 * parsing works by stripping known-shape tokens (time, reader code, trailing
 * serial number) from a known position rather than splitting on whitespace.
 */
export function parseLinesFromText(text: string): RawParsedLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const records: RawParsedLine[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    if (isHeaderOrJunkLine(line)) continue;

    const timeToken = extractTimeToken(line);
    if (!timeToken) continue; // a patrol record line must contain a time; otherwise skip as noise

    const timeIndex = line.indexOf(timeToken);
    const before = line.slice(0, timeIndex).trim();
    let after = line.slice(timeIndex + timeToken.length).trim();

    // Strip a leading reader code directly glued to the checkpoint text (flattened layout)
    after = after.replace(READER_CODE_AT_START, "").trim();

    // Strip a leading serial number in case time comes after the columns (spaced/tabular layout)
    const withoutSerial = before.replace(/^\d+[.)]?\s*/, "").trim();

    // Reader code as its own whitespace-delimited token (spaced/tabular layout)
    const tokens = withoutSerial.split(/\s+/).filter(Boolean);
    while (tokens.length > 1) {
      const last = tokens[tokens.length - 1];
      const looksLikeCode = /\d/.test(last) && /^[A-Za-z0-9-]+$/.test(last);
      if (looksLikeCode) tokens.pop();
      else break;
    }
    const beforeCleaned = tokens.join(" ").trim();

    // Prefer whichever side actually has checkpoint-looking text left. In the
    // flattened layout (time first) the name is in `after`, glued to a
    // trailing serial number we still need to strip; in the tabular layout
    // (time last) the name is in `beforeCleaned` already.
    let checkpoint: string;
    if (after) {
      checkpoint = after.replace(/\d+$/, "").trim();
    } else {
      checkpoint = beforeCleaned;
    }

    let guard: string | null = null;
    const dashSplit = checkpoint.split(/\s{2,}|\t|\|/).filter(Boolean);
    if (dashSplit.length >= 2) {
      guard = dashSplit[0];
      checkpoint = dashSplit.slice(1).join(" ");
    }

    records.push({
      lineNumber,
      rawLine: line,
      guard,
      checkpoint: checkpoint || null,
      timeToken
    });
  }

  return records;
}
