/**
 * Best-effort detection of which plant (and patrol date) an uploaded patrol PDF
 * belongs to, based purely on its filename. Real filenames vary a lot, e.g.:
 *   "TAG 1 A 16 June 26.pdf"      -> TAG 1A, 2026-06-16
 *   "TAG ONE A 08 June 26.pdf"    -> TAG 1A, 2026-06-08
 *   "TAG FOUR 06 June 26.pdf"     -> TAG 4,  2026-06-06
 *   "STK 16 June 26 DAY.pdf"      -> STK,    2026-06-16
 *   "SSVF 16 June 26.pdf"         -> SSVF,   2026-06-16
 */

const WORD_NUM: Record<string, string> = { ONE: "1", TWO: "2", THREE: "3", FOUR: "4", FIVE: "5" };

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
};

/** Collapses a name to an alnum-only uppercase token, mapping ONE..FIVE to digits. */
function normalizeToken(name: string): string {
  return name
    .toUpperCase()
    .replace(/\.PDF$/i, "")
    .replace(/\b(ONE|TWO|THREE|FOUR|FIVE)\b/g, (m) => WORD_NUM[m])
    .replace(/[^A-Z0-9]/g, "");
}

/** Returns the id of the best-matching plant for a filename, or null if none. */
export function detectPlantId(fileName: string, plants: { id: string; name: string }[]): string | null {
  const normFile = normalizeToken(fileName);

  let best: { id: string; tokenLength: number } | null = null;
  for (const p of plants) {
    const token = normalizeToken(p.name); // e.g. "TAG 1A" -> "TAG1A"
    if (token && normFile.includes(token)) {
      // Prefer the longest matching plant token so "TAG1A" wins over any shorter
      // partial and "TAG1A" is never confused with "TAG1B".
      if (!best || token.length > best.tokenLength) best = { id: p.id, tokenLength: token.length };
    }
  }
  return best?.id ?? null;
}

/** Parses a "16 June 26" / "02 Apr 2026" style date from a filename to YYYY-MM-DD, or null. */
export function detectPatrolDate(fileName: string): string | null {
  const m = fileName.match(/(\d{1,2})\s*[-_ ]?\s*([A-Za-z]{3,})\s*[-_ ]?\s*(\d{2,4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].slice(0, 3).toUpperCase()];
  let year = Number(m[3]);
  if (!month || day < 1 || day > 31) return null;
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
