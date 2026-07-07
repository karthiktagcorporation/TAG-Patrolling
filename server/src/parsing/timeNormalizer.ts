/**
 * Normalizes the many time formats seen in real patrol PDFs into a strict
 * "HH:mm:ss" 24-hour string plus, when present, a date part "YYYY-MM-DD".
 *
 * Formats observed in sample files:
 *  - "16-06-2026 22:01:52"          (dd-mm-yyyy HH:mm:ss)
 *  - "17-06-2026 00:05:15"
 *  - "220152"                        (compact HHmmss, same-day implied)
 *  - "95459 PM"                      (OCR-flattened, missing colons, with meridiem)
 *  - "10038 AM"                      (5-digit compact, ambiguous leading digit)
 */

export interface NormalizedTime {
  raw: string;
  date: string | null; // YYYY-MM-DD if detected
  time: string | null; // HH:mm:ss 24h, null if unparseable
  ok: boolean;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function buildResult(raw: string, date: string | null, h: number, m: number, s: number): NormalizedTime {
  if (h > 23 || m > 59 || s > 59 || h < 0 || m < 0 || s < 0) {
    return { raw, date, time: null, ok: false };
  }
  return { raw, date, time: `${pad(h)}:${pad(m)}:${pad(s)}`, ok: true };
}

/** Parses a compact digit string (4-6 digits) into h/m/s, applying an optional AM/PM meridiem. */
function parseCompactDigits(digits: string, meridiem: string | null): { h: number; m: number; s: number } | null {
  let h: number, m: number, s: number;

  if (digits.length === 6) {
    h = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
    s = Number(digits.slice(4, 6));
  } else if (digits.length === 5) {
    // Ambiguous: could be H:MM:SS (1-digit hour) e.g. "95459" -> 9:54:59
    h = Number(digits.slice(0, 1));
    m = Number(digits.slice(1, 3));
    s = Number(digits.slice(3, 5));
  } else if (digits.length === 4) {
    h = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
    s = 0;
  } else {
    return null;
  }

  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === "PM" && h < 12) h += 12;
    if (upper === "AM" && h === 12) h = 0;
  }

  return { h, m, s };
}

export function normalizeTime(input: string): NormalizedTime {
  const raw = input.trim();
  if (!raw) return { raw, date: null, time: null, ok: false };

  // 1) dd-mm-yyyy HH:mm:ss (dash separator) or mm/dd/yyyy H:mm:ss AM/PM (slash separator,
  // as produced by some patrol devices e.g. "6/16/2026 9:54:59 PM")
  const full = raw.match(/(\d{1,2})([-/])(\d{1,2})[-/](\d{4})[ T]+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i);
  if (full) {
    const [, first, sep, second, yyyy, hh, min, ss, mer] = full;
    const [dd, mm] = sep === "/" ? [second, first] : [first, second];
    const date = `${yyyy}-${pad(Number(mm))}-${pad(Number(dd))}`;
    const parsed = parseCompactDigits(`${pad(Number(hh))}${min}${ss}`, mer ?? null);
    if (parsed) return buildResult(raw, date, parsed.h, parsed.m, parsed.s);
    return buildResult(raw, date, Number(hh), Number(min), Number(ss));
  }

  // 2) HH:mm:ss or HH:mm with optional AM/PM, no date
  const colonTime = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (colonTime) {
    const [, hh, min, ss, mer] = colonTime;
    const parsed = parseCompactDigits(`${pad(Number(hh))}${min}${ss ?? "00"}`, mer ?? null);
    if (parsed) return buildResult(raw, null, parsed.h, parsed.m, parsed.s);
  }

  // 3) OCR-flattened compact digits with meridiem, e.g. "95459 PM", "10038 AM"
  const compactWithMeridiem = raw.match(/(\d{4,6})\s*(AM|PM)/i);
  if (compactWithMeridiem) {
    const [, digits, mer] = compactWithMeridiem;
    const parsed = parseCompactDigits(digits, mer);
    if (parsed) return buildResult(raw, null, parsed.h, parsed.m, parsed.s);
  }

  // 4) Pure compact digits, no separators, no meridiem (assume 24h HHmmss)
  const compact = raw.match(/^(\d{4,6})$/);
  if (compact) {
    const parsed = parseCompactDigits(compact[1], null);
    if (parsed) return buildResult(raw, null, parsed.h, parsed.m, parsed.s);
  }

  return { raw, date: null, time: null, ok: false };
}

/** Extracts the first date+time-looking token found anywhere in a raw text line. */
export function extractTimeToken(line: string): string | null {
  const patterns = [
    /\d{1,2}[-/]\d{1,2}[-/]\d{4}[ T]+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?/i,
    /\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?/i,
    /\d{4,6}\s*(?:AM|PM)/i,
    /\b\d{6}\b/
  ];
  for (const p of patterns) {
    const m = line.match(p);
    if (m) return m[0];
  }
  return null;
}
