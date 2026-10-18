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

/** Parse numbers only inside candidate spans; never rewrite description tokens. */
function scalar(tokens, i) {
  const t = tokens[i]?.lower;
  if (!t) return null;
  if (/^\d+(?:\.\d+)?$/.test(t)) return { value: Number(t), end: i };
  if (!(t in UNITS) && !(t in TENS)) return null;
  let value = UNITS[t] ?? TENS[t], end = i;
  if (tokens[end + 1]?.lower === 'hundred' && value > 0 && value < 10) {
    value *= 100; end++;
    if (tokens[end + 1]?.lower === 'and') end++;
    const rest = scalar(tokens, end + 1);
    if (rest && rest.value < 100) { value += rest.value; end = rest.end; }
  } else if (t in TENS && (tokens[i + 1]?.lower in UNITS) && UNITS[tokens[i + 1].lower] > 0 && UNITS[tokens[i + 1].lower] < 10) {
    value += UNITS[tokens[++end].lower];
  }
  return { value, end };
}

function moneySpans(tokens) {
  const explicit = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].lower;
    const marked = /^(?:s?\$)\s*\d/.test(t);
    const currency = t === 'sgd';
    const number = marked ? { value: Number(t.replace(/s?\$\s*/i, '')), end: i } : scalar(tokens, currency ? i + 1 : i);
    if (!number) continue;
    let end = number.end, amount = number.value;
    if (/^(dollars?|bucks?|sgd)$/.test(tokens[end + 1]?.lower ?? '')) {
      end++;
      const fractionStart = tokens[end + 1]?.lower === 'and' ? end + 2 : end + 1;
      const fraction = scalar(tokens, fractionStart);
      if (Number.isInteger(number.value) && fraction && Number.isInteger(fraction.value) && fraction.value < 100 && (fraction.value >= 10 || fraction.end === tokens.length - 1 || /^cents?$/.test(tokens[fraction.end + 1]?.lower ?? ''))) {
        amount += fraction.value / 100; end = fraction.end;
        if (/^cents?$/.test(tokens[end + 1]?.lower ?? '')) end++;
      }
    } else if (/^cents?$/.test(tokens[end + 1]?.lower ?? '')) {
      amount = Number.isInteger(amount) && amount < 100 ? amount / 100 : NaN; end++;
    } else if (!marked && !currency) continue;
    if (/^(minus|negative)$/.test(tokens[i - 1]?.lower ?? '') || tokens[i].negative) amount = NaN;
    explicit.push({ from: i, to: end, amount, total: /^(total|totalling|totaling)$/.test(tokens[i - 1]?.lower ?? '') });
    i = end;
  }
  if (explicit.length) {
    const totals = explicit.filter(span => span.total);
    return totals.length === 1 ? totals : explicit;
  }
  const bare = [];
  for (let i = 0; i < tokens.length; i++) {
    const first = scalar(tokens, i);
    if (!first) continue;
    let { value: amount, end } = first;
    let colloquial = false;
    const next = tokens[end + 1]?.lower;
    // Keep the established “four fifty” shortcut, but not “7 Eleven”.
    if (Number.isInteger(amount) && amount < 1000 && ((next in TENS) || /^\d{2}$/.test(next ?? ''))) {
      const fraction = scalar(tokens, end + 1);
      if (fraction && fraction.value < 100) { amount += fraction.value / 100; end = fraction.end; colloquial = true; }
    }
    bare.push({ from: i, to: end, amount, moneyLike: colloquial || tokens[i].lower.includes('.') || /^(spent|paid|pay|cost|price|total)$/.test(tokens[i - 1]?.lower ?? '') || (i === 0 && end === tokens.length - 1) });
    i = end;
  }
  return bare.length === 1 && !bare[0].moneyLike ? [] : bare;
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

export function parseVoiceDraft(transcript, cats = [], now = new Date()) {
  if (!transcript || typeof transcript !== 'string') return { fields: {}, amountStatus: 'missing' };
  const tokens = [...transcript.matchAll(/s?\$\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?|[\p{L}]+/giu)].map(m => ({ raw: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length, negative: transcript[m.index - 1] === '-' }));
  const candidates = moneySpans(tokens);
  const found = candidates.length === 1 && candidates[0].amount > 0 ? candidates[0] : null;
  let description = transcript;
  if (found) {
    let from = tokens[found.from].start, to = tokens[found.to].end;
    const previous = tokens[found.from - 1];
    if (previous && /^(for|at|on|total|totalling|totaling)$/.test(previous.lower)) from = previous.start;
    const next = tokens[found.to + 1];
    if (next && /^(for|at|on)$/.test(next.lower)) to = next.end;
    description = `${transcript.slice(0, from)} ${transcript.slice(to)}`;
  }
  const hasYesterday = /\byesterday\b/i.test(transcript);
  description = description.replace(/\b(today|yesterday)\b/gi, ' ')
    .replace(/^\s*(?:(?:please\s+)?(?:i\s+)?(?:spent|paid|pay|add(?:\s+an?\s+expense)?|record(?:\s+an?\s+expense)?|log|new expense)\b[\s,]*)+/i, '')
    .replace(/^\s*(for|on|at)\s+/i, '')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').replace(/\s+/g, ' ').trim();
  const category = matchCategory(description.toLowerCase().split(/\s+/), cats);
  const fields = {};
  if (found) fields.amount = found.amount.toFixed(2);
  if (description) fields.description = description.replace(/^\p{L}/u, m => m.toUpperCase());
  if (category) fields.category = category;
  if (hasYesterday) fields.date = shiftDays(-1, now);
  return { fields, amountStatus: found ? 'resolved' : candidates.length > 1 ? 'ambiguous' : 'missing' };
}

export function parseUtterance(transcript, cats = [], now = new Date()) {
  return parseVoiceDraft(transcript, cats, now).fields;
}
