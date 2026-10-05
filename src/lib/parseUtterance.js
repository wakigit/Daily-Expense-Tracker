import { today } from './format';

/**
 * Turns a spoken sentence into expense form fields.
 *
 * Pure function, no browser APIs — so every case below is unit-tested in Node.
 * It deliberately returns ONLY what it is confident about; anything it can't
 * read is left undefined for the user to fill in. Guessing an amount would be
 * far worse than leaving it blank.
 *
 *   "four fifty for chicken rice"  → { amount: '4.50', description: 'chicken rice' }
 *   "add twelve dollars grab"      → { amount: '12.00', description: 'grab' }
 *   "spent $23.90 on shopping yesterday"
 *                                  → { amount: '23.90', category: 'shop', date: <yesterday> }
 */

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Words that carry no meaning for a description. */
const FILLER = new Set([
  'add', 'added', 'adding', 'new', 'entry', 'expense', 'expenditure', 'record',
  'log', 'spent', 'spend', 'spending', 'paid', 'pay', 'for', 'on', 'at', 'of',
  'a', 'an', 'the', 'i', 'my', 'me', 'to', 'in', 'it', 'was', 'is', 'and',
  'dollar', 'dollars', 'buck', 'bucks', 'cent', 'cents', 'sgd', 'dollarss',
  'today', 'yesterday', 'please', 'just', 'some', 'about',
]);

/**
 * Collapses number words into digits, honouring English composition:
 *   "twenty five"  → 25   (tens + unit is a real compound)
 *   "four fifty"   → 4 50 (unit + tens is not — it's dollars and cents)
 */
function wordsToDigits(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if (t in TENS) {
      if (next in UNITS && UNITS[next] > 0 && UNITS[next] < 10) {
        out.push(String(TENS[t] + UNITS[next]));
        i++;
        continue;
      }
      out.push(String(TENS[t]));
      continue;
    }
    if (t in UNITS) { out.push(String(UNITS[t])); continue; }
    if (t === 'hundred' && out.length) {
      out[out.length - 1] = String(Number(out[out.length - 1]) * 100);
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Finds the amount and reports which token positions it consumed. */
function extractAmount(tokens) {
  const isNum = (t) => t !== undefined && /^\d+(\.\d+)?$/.test(t);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isNum(t)) continue;

    const a = Number(t);
    const next = tokens[i + 1];
    const after = tokens[i + 2];

    // "4 dollars 50" / "4 dollars 50 cents" / "4 dollars and 50"
    if (/^dollars?$|^bucks?$/.test(next || '')) {
      const cents = after === 'and' ? tokens[i + 3] : after;
      if (isNum(cents) && Number(cents) < 100 && !/^\d+\.\d/.test(cents)) {
        const span = after === 'and' ? 4 : 3;
        return { amount: a + Number(cents) / 100, from: i, to: i + span - 1 };
      }
      return { amount: a, from: i, to: i + 1 };
    }

    // Already decimal: "4.50"
    if (t.includes('.')) return { amount: a, from: i, to: i };

    // Colloquial "four fifty" → 4.50. Only when the second part is a plain
    // two-digit number; "twenty five" was already collapsed to one token.
    if (isNum(next) && !next.includes('.') && Number(next) < 100 && next.length <= 2 && a < 1000) {
      return { amount: a + Number(next) / 100, from: i, to: i + 1 };
    }

    return { amount: a, from: i, to: i };
  }
  return null;
}

/** Matches leftover words against the user's real category labels. */
function matchCategory(words, cats = []) {
  const text = words.join(' ');
  for (const c of cats) {
    const label = (c.label || '').toLowerCase();
    if (!label) continue;
    if (text.includes(label)) return c.id;
    // Also match any distinctive single word of a multi-word label,
    // e.g. "transport" for "Public transport".
    const parts = label.split(/\s+/).filter((w) => w.length > 3);
    if (parts.some((w) => words.includes(w))) return c.id;
  }
  return undefined;
}

/**
 * "yesterday" relative to the Singapore day, not UTC. Said at 1am, UTC is still
 * two days back from the speaker's "yesterday"; this was producing the wrong
 * date on exactly the expenses people dictate late at night.
 *
 * The shift itself is done in UTC on a bare calendar date, which has no DST and
 * no local-offset surprises.
 */
const shiftDays = (n, now = new Date()) => {
  const [y, m, d] = today(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export function parseUtterance(transcript, cats = [], now = new Date()) {
  if (!transcript || typeof transcript !== 'string') return {};

  const raw = transcript.toLowerCase().replace(/[^\w\s.$-]/g, ' ');
  const hasYesterday = /\byesterday\b/.test(raw);

  // "$4.50" → "4.50" so the $ doesn't break tokenising.
  const tokens = wordsToDigits(
    raw.replace(/\$\s*/g, ' ').split(/[\s-]+/).filter(Boolean)
  );

  const found = extractAmount(tokens);

  const leftover = tokens
    .filter((_, i) => !found || i < found.from || i > found.to)
    .filter((t) => !FILLER.has(t))
    // A bare number that isn't the amount is noise, not a description.
    .filter((t) => !/^\d+(\.\d+)?$/.test(t));

  const category = matchCategory(leftover, cats);

  // Don't repeat the category name back as the description when it's all
  // that was said — "spent 20 on shopping" should describe itself.
  const catLabel = cats.find((c) => c.id === category)?.label?.toLowerCase() ?? '';
  const descWords = leftover.filter((w) => !catLabel.split(/\s+/).includes(w));
  const description = (descWords.length ? descWords : leftover).join(' ').trim();

  const out = {};
  if (found && found.amount > 0) out.amount = found.amount.toFixed(2);
  if (description) out.description = description.replace(/\b\w/, (m) => m.toUpperCase());
  if (category) out.category = category;
  if (hasYesterday) out.date = shiftDays(-1, now);
  return out;
}
