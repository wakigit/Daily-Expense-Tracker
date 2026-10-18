/** Shared browser/server boundary. No ledger, notes, IDs or free-form fact text. */
export const MAX_ROAST_BYTES = 4096;
export const MAX_ROAST_TEXT = 120;
export const ROAST_ANGLES = ['dramatic_narration', 'absurd_accounting', 'corporate_report', 'singapore', 'smu'];
export const ROAST_DEFAULTS = { enabled: true, name: '', singapore: false, smu: false };
export function roastPreferences(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return { enabled: value.enabled !== false, name: typeof value.name === 'string' ? value.name.slice(0, 40) : '', singapore: value.singapore === true, smu: value.smu === true };
}
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v, max, empty = false) => typeof v === 'string' && (empty || v.trim().length > 0) && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const integer = (v, max = 100_000_000_000) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

export function validateRoastInput(raw) {
  try {
    if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_ROAST_BYTES) return { ok: false, code: 'roast_too_large' };
    if (!exact(raw, ['transaction', 'facts', 'budget', 'angle', 'preferences'])) return { ok: false, code: 'invalid_roast_input' };
    const { transaction: t, facts, budget: b, preferences: p, angle } = raw;
    if (!exact(t, ['description', 'amountCents', 'category']) || !text(t.description, 80) || !integer(t.amountCents, 100_000_000) || t.amountCents === 0 || !text(t.category, 80)) throw 0;
    if (!Array.isArray(facts) || facts.length > 3 || !facts.every(f => exact(f, ['kind', 'start', 'end', 'count', 'totalCents']) && ['repeat_week', 'repeat_month', 'category_month'].includes(f.kind) && date(f.start) && date(f.end) && f.start <= f.end && integer(f.count, 1_000_000) && f.count > 0 && integer(f.totalCents))) throw 0;
    if (new Set(facts.map(f => f.kind)).size !== facts.length) throw 0;
    if (!exact(b, ['band', 'intensity', 'categoryUsagePct']) || !['under', 'near', 'over', 'none', 'historical'].includes(b.band)) throw 0;
    const expected = b.band === 'over' ? 2 : b.band === 'near' ? 1 : 0;
    if (b.intensity !== expected || !(b.categoryUsagePct === null || integer(b.categoryUsagePct, 1_000_000_000))) throw 0;
    if (['none', 'historical'].includes(b.band) && b.categoryUsagePct !== null) throw 0;
    if (!exact(p, ['name', 'singapore', 'smu']) || !text(p.name, 40, true) || typeof p.singapore !== 'boolean' || typeof p.smu !== 'boolean') throw 0;
    if (!ROAST_ANGLES.includes(angle) || (angle === 'singapore' && !p.singapore) || (angle === 'smu' && !p.smu)) throw 0;
    // Rebuild a plain allowlisted payload. A description/name is data, not an instruction.
    return { ok: true, value: { transaction: { ...t }, facts: facts.map(f => ({ ...f })), budget: { ...b }, angle, preferences: { ...p } } };
  } catch { return { ok: false, code: 'invalid_roast_input' }; }
}

// Conservative English claim checks, not a general semantic proof. Fail closed to the
// existing offline quip when a recognisable history claim lacks the required evidence.
function supportedHistory(value, input) {
  const repeats = input.facts.filter(f => ['repeat_week', 'repeat_month'].includes(f.kind) && f.count >= 2);
  if (!repeats.length && /\b(?:again|another|repeat(?:ed|s)?|habit\w*|loyal\w*|regular\w*|always|daily|weekly|monthly|every)\b/i.test(value)) return false;
  // Even exact-description records cannot prove meals eaten, visits or loyalty.
  if (/\bloyal(?:ty)?\b/i.test(value)) return false;
  const units = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const number = String.raw`(?:\d+|${Object.keys(units).join('|')})(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?`;
  const claims = new RegExp(String.raw`\b(${number})\s+((?:[\p{L}'’-]+\s+){0,8}?)(meals?|visits?|purchases?|buys?|transactions?|orders?|times)\b`, 'giu');
  for (const match of value.matchAll(claims)) {
    // A price followed by purchase wording is not a count (e.g. 23 dollars for a meal).
    if (/^(?:dollars?|bucks?|cents?)\b/i.test(match[2])) continue;
    const count = /^\d+$/.test(match[1]) ? Number(match[1]) : match[1].toLowerCase().split(/[- ]/).reduce((sum,w)=>sum+(units[w] ?? 0),0);
    if (/^(?:meals?|visits?)$/i.test(match[3]) || !/\brecorded\b/i.test(match[2]) || !repeats.some(f=>f.count===count)) return false;
  }
  return true;
}

export function validateRoastOutput(raw, input) {
  const bad = reason => ({ ok: false, reason });
  if (!exact(raw, ['text']) || typeof raw.text !== 'string') return bad('shape');
  if (!raw.text.trim()) return bad('empty');
  if (raw.text.length > MAX_ROAST_TEXT) return bad('length');
  if (/[\u0000-\u001f\u007f]/.test(raw.text)) return bad('control_characters');
  const value = raw.text.trim();
  if (/[<>]|https?:|www\./i.test(value)) return bad('unsafe_markup');
  if (value.split(/[.!?]+(?:\s+|$)/).filter(Boolean).length !== 1 || !/[.!?]$/.test(value)) return bad('sentences');
  if (input && !supportedHistory(value, input)) return bad('unsupported_history');
  return { ok: true, text: value };
}
