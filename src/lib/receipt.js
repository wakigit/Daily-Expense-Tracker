/**
 * The contract between a photographed receipt and this application.
 *
 * A receipt scan produces a DRAFT, not an expense. Nothing here writes a row:
 * the fields land in the Add form, the person looks at them, and the ordinary
 * submit path in lib/actions.js is still the only thing that creates an
 * expense. That is the same rule VoiceButton follows, and for the same reason —
 * a misread total that files itself is worse than no shortcut at all. OCR
 * misreads 1 as 7, loses decimal points, and confidently returns the subtotal
 * instead of the total.
 *
 * Imported by BOTH halves, like lib/intent.js. The backend validates before it
 * replies; the frontend validates again on arrival.
 *
 * A partly-read receipt is still worth having, so an unreadable FIELD is not an
 * error — it comes back null and is listed in `missing`, and the form keeps
 * whatever the person already typed there. Only a malformed RESPONSE, or a
 * category the model invented, is rejected outright.
 */

// The extension is required, not stylistic. This file is imported by the
// backend as well as by Vite, and Node's ESM resolver does not guess it the
// way a bundler does. lib/intent.js never hit this because it imports nothing.
import { parseAmount, parseDate, MAX_DESCRIPTION } from './actions.js';

/** Every field the scan can fill. The Add form's fields, minus notes. */
export const RECEIPT_FIELDS = ['description', 'amount', 'category', 'date'];

export const RECEIPT_ERR = {
  NOT_OBJECT: 'receipt_not_object',
  UNKNOWN_CATEGORY: 'receipt_unknown_category',
  NOT_A_RECEIPT: 'receipt_not_a_receipt',
};

/** The app keeps its books in one currency; see `foreign` below. */
export const HOME_CURRENCY = 'SGD';

/**
 * The largest decoded image the endpoint accepts, in bytes.
 *
 * Shared by both halves on purpose: the browser checks it before spending time
 * on an upload it knows will bounce, and the server checks it because a
 * client-side limit is a courtesy, not a control. lib/receiptImage.js
 * downscales to roughly a tenth of this, so hitting it means something is
 * wrong rather than that someone photographed a long receipt.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const bad = (code, extra = {}) => ({ ok: false, error: { code, ...extra } });
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const trimmed = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/**
 * Validates and narrows a raw vision response into a form-ready draft.
 *
 * `today` bounds the date: a receipt dated next year is a misread year, and
 * accepting it would file the expense into a month nobody looks at. Out-of-range
 * dates are dropped to null rather than rejected — the rest of the scan is
 * still good.
 */
export function validateReceipt(raw, { cats = [], today = '' } = {}) {
  if (!isPlainObject(raw)) return bad(RECEIPT_ERR.NOT_OBJECT);

  // The model is asked to say so rather than invent fields for a photo of a
  // cat. Without this it will dutifully return a plausible-looking expense.
  if (raw.isReceipt === false) return bad(RECEIPT_ERR.NOT_A_RECEIPT);

  const catIds = cats.map((c) => c.id);
  const missing = [];

  const description = trimmed(raw.description).slice(0, MAX_DESCRIPTION);
  if (!description) missing.push('description');

  // parseAmount is the same reader the form and the assistant use, so "S$4.50",
  // "4,230.00" and 4.5 all land identically. A total it cannot read is a
  // missing total, not a zero.
  let amount = null;
  if (raw.amount != null && raw.amount !== '') {
    const parsed = parseAmount(raw.amount);
    if (parsed.ok) amount = String(parsed.value.toFixed(2));
  }
  if (amount === null) missing.push('amount');

  const category = raw.category == null || raw.category === '' ? null : trimmed(raw.category);
  if (category !== null && !catIds.includes(category)) {
    // Not merely dropped. A category the model invented means it was not
    // choosing from the list it was given, and the rest of its answer is
    // suspect too.
    return bad(RECEIPT_ERR.UNKNOWN_CATEGORY, { category, known: catIds });
  }
  if (category === null) missing.push('category');

  let date = null;
  if (raw.date) {
    const parsed = parseDate(raw.date, '');
    // A receipt cannot be from the future, and a year misread by a digit is the
    // single most common way that happens.
    if (parsed.ok && parsed.value && (!today || parsed.value <= today)) date = parsed.value;
  }
  if (date === null) missing.push('date');

  // A 3-letter code, or nothing. Reported, never converted: this app has no
  // exchange rates, and inventing one would put a wrong number in the ledger.
  const code = trimmed(raw.currency).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(code) ? code : null;
  const foreign = currency !== null && currency !== HOME_CURRENCY;

  return {
    ok: true,
    draft: { description, amount, category, date, currency, foreign, missing },
  };
}

/**
 * The draft as form fields, with the unread ones left out entirely.
 *
 * Omission is the default. App.jsx merges these over the current form, so a
 * field the scan could not read keeps whatever is already in it instead of
 * being blanked — the same contract applyVoice has.
 *
 * TWO FIELDS BREAK THAT DEFAULT, because for them "leave it as it was" is the
 * unsafe answer:
 *
 *  - **A foreign total is actively CLEARED, not merely omitted.** The form's
 *    amount is Singapore dollars; the figure on a US receipt is not. Writing
 *    19.06 into an SGD field because the receipt said USD 19.06 records a
 *    number that was never spent, and nothing downstream could detect it — the
 *    row looks ordinary for ever after. This app holds no exchange rates, so
 *    the honest move is to leave the field empty and make the person enter the
 *    converted figure. The printed total is still reported to them in words;
 *    see ReceiptButton.
 *
 *    Omitting it was not enough, and that was a real bug: these fields are
 *    MERGED over the form, so omission keeps whatever was already in the box.
 *    Someone who had typed 12.30 for a lunch, then scanned a USD receipt,
 *    kept 12.30 sitting under the new shop's name and date — a figure
 *    belonging to neither receipt, one tap from being saved, while the message
 *    told them nothing had been filled in. Clearing is the only safe default:
 *    the scan replaced the rest of the form, so the stale amount is no longer
 *    anybody's answer.
 *
 *  - **An unknown category is actively cleared, not merely omitted.** Every
 *    other form field defaults to empty, so omitting it is visibly "not filled
 *    in". Category defaults to the FIRST category — Food — so omitting it
 *    leaves a confident-looking selection the scan never made. Blanking it
 *    forces the choice to be made deliberately. `validateExpense` is asked to
 *    require a category on this path for the same reason: left to itself it
 *    falls back to cats[0], which is precisely the silent miscategorisation
 *    this is here to prevent.
 */
export function receiptToFields(draft) {
  const fields = {};
  for (const key of RECEIPT_FIELDS) {
    if (key === 'amount' && draft?.foreign) continue;
    if (draft?.[key] != null && draft[key] !== '') fields[key] = draft[key];
  }
  if (!fields.category) fields.category = '';
  // Both overrides are the same shape: an empty string BEATS the merge, where
  // an absent key loses to it.
  if (draft?.foreign) fields.amount = '';
  return fields;
}

/**
 * The scan applied to the form — the whole of what a scan does to what you
 * were typing.
 *
 * This exists so the merge has ONE definition that can be tested. It was an
 * expression inside App.jsx before, which meant the unit tests could only
 * check the fields in isolation and could not see the thing that actually goes
 * wrong: what the form LOOKS LIKE afterwards. The foreign-amount bug lived
 * precisely in that gap — `receiptToFields` was correct about what it offered,
 * and the merged result was still wrong.
 */
export function mergeReceiptIntoForm(form = {}, draft) {
  return { ...form, ...receiptToFields(draft) };
}

/**
 * The printed total, as it should be quoted back — never a bare `null`.
 *
 * A foreign receipt whose total ALSO could not be read is the overlap of two
 * cases, and the message has to be honest about both: the currency is wrong
 * for this field and the figure is unknown. Returns null when there is nothing
 * to quote, so the caller picks the sentence rather than interpolating a
 * `null` into one.
 */
export function printedTotal(draft) {
  if (!draft?.currency || draft.amount == null || draft.amount === '') return null;
  return `${draft.currency} ${draft.amount}`;
}

/** What the scan could not read, in words. Empty string when it read it all. */
export function describeMissing(missing = []) {
  const words = {
    description: 'the shop name',
    amount: 'the total',
    category: 'a category',
    date: 'the date',
  };
  const list = missing.map((m) => words[m] ?? m);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
