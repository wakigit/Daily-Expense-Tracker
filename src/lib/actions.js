/**
 * Every change to the expense list goes through here.
 *
 * The point is that there is exactly ONE implementation of "add an expense" and
 * "delete an expense", and both the buttons and (later) the assistant call it.
 * If the assistant had its own copy, the two would drift, and the first symptom
 * would be the assistant reporting a number the screen disagrees with — the
 * failure mode docs/PRD.md §8 is written to prevent.
 *
 * Everything here is pure: `(expenses, input) -> { expenses, action }`. No
 * React, no localStorage, no network, no clock unless one is passed in. That is
 * what makes it deterministic, testable in Node, and safe to import from the
 * backend when the chat endpoint lands.
 *
 * Nothing here talks to a model. The model's job will be to turn a sentence
 * into one of these calls; the arithmetic and the validation stay on this side.
 */

// Extension required: the docstring above promises this file is importable
// from the backend, and Node's ESM resolver — unlike Vite — does not infer it.
import { toCents, roundAmount } from './money.js';

/** Anything above this is a typo, not a kopi. */
export const MAX_AMOUNT = 1_000_000;
export const MAX_DESCRIPTION = 80;

export const ERR = {
  DESCRIPTION_REQUIRED: 'description_required',
  DESCRIPTION_TOO_LONG: 'description_too_long',
  AMOUNT_REQUIRED: 'amount_required',
  AMOUNT_INVALID: 'amount_invalid',
  AMOUNT_NOT_POSITIVE: 'amount_not_positive',
  AMOUNT_TOO_LARGE: 'amount_too_large',
  CATEGORY_UNKNOWN: 'category_unknown',
  CATEGORY_REQUIRED: 'category_required',
  DATE_INVALID: 'date_invalid',
  DUPLICATE: 'duplicate',
  NOT_FOUND: 'not_found',
  NOTHING_TO_UNDO: 'nothing_to_undo',
  ALREADY_REMOVED: 'already_removed',
  ALREADY_RESTORED: 'already_restored',
  EXPENSE_MODIFIED: 'expense_modified',
};

const fail = (code, extra = {}) => ({ ok: false, error: { code, ...extra } });

/* ── Identity ──────────────────────────────────────────────────── */

/**
 * Ids were `Date.now()`, which is fine while a human taps one in at a time and
 * broken the moment anything adds two in the same millisecond — exactly what an
 * assistant filing a receipt would do. The counter makes collisions impossible
 * without reaching for randomness, which would make these tests flaky.
 *
 * Existing saved rows keep their numeric ids. Nothing migrates: ids are only
 * ever compared for equality, so the two forms coexist indefinitely.
 */
let seq = 0;
export function newExpenseId(now = Date.now()) {
  seq = (seq + 1) % 0xffff;
  return `e${now.toString(36)}-${seq.toString(36)}`;
}

/**
 * An action's own identity, which is NOT the id of the expense it touched.
 *
 * Both an add and a later delete of the same row carry that row's id, so a
 * caller holding an expense id cannot say which of the two it means. Looking
 * one up by expense id finds the add first and tries to reverse that instead —
 * and reversing an add whose row has just been deleted fails as
 * `already_removed`, so Undo offered a button that quietly did nothing. The
 * toast now carries this instead.
 */
let actionSeq = 0;
export function newActionId(now = Date.now()) {
  actionSeq = (actionSeq + 1) % 0xffff;
  return `a${now.toString(36)}-${actionSeq.toString(36)}`;
}

/* ── Validation ────────────────────────────────────────────────── */

/** Case- and space-insensitive, so "Chicken Rice" and "chicken rice" match. */
export const normaliseDescription = (s) =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Money, from a human or a model. Accepts "4.50", "S$4.50", "$4.50", "1,234.50"
 * and the number 4.5 — a model will produce any of these — then rejects
 * anything that is not a positive, finite, sane amount.
 */
export function parseAmount(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return fail(ERR.AMOUNT_INVALID, { field: 'amount' });
    return gradeAmount(raw);
  }
  const text = String(raw ?? '').trim();
  if (!text) return fail(ERR.AMOUNT_REQUIRED, { field: 'amount' });

  const cleaned = text.replace(/[Ss]\$|\$|,|\s/g, '');
  // Reject "12.3.4", "1e5", "abc" — only a plain decimal is money.
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return fail(ERR.AMOUNT_INVALID, { field: 'amount' });

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return fail(ERR.AMOUNT_INVALID, { field: 'amount' });
  return gradeAmount(n);
}

function gradeAmount(n) {
  if (n <= 0) return fail(ERR.AMOUNT_NOT_POSITIVE, { field: 'amount' });
  if (n > MAX_AMOUNT) return fail(ERR.AMOUNT_TOO_LARGE, { field: 'amount', max: MAX_AMOUNT });
  // Snap to a whole cent, because a third decimal is not money. This does NOT
  // make later addition exact — 0.1 and 0.2 are already two decimals and still
  // sum to 0.30000000000000004. Exactness comes from summing in integer cents;
  // see lib/money.js. This only fixes the input.
  return { ok: true, value: roundAmount(n) };
}

/** YYYY-MM-DD, and a date that actually exists — 2026-02-31 does not. */
export function parseDate(raw, today) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, value: today };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fail(ERR.DATE_INVALID, { field: 'date' });

  const [y, m, d] = text.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const real = probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return real ? { ok: true, value: text } : fail(ERR.DATE_INVALID, { field: 'date' });
}

/**
 * Normalises one expense input into the stored shape, or says why it cannot.
 * Returns the FIRST problem rather than a list: the form highlights one field
 * at a time, and an assistant needs one thing to ask about, not five.
 */
export function validateExpense(input = {}, { cats = [], today = '', requireCategory = false } = {}) {
  const description = String(input.description ?? '').trim().replace(/\s+/g, ' ');
  if (!description) return fail(ERR.DESCRIPTION_REQUIRED, { field: 'description' });
  if (description.length > MAX_DESCRIPTION) {
    return fail(ERR.DESCRIPTION_TOO_LONG, { field: 'description', max: MAX_DESCRIPTION });
  }

  const amount = parseAmount(input.amount);
  if (!amount.ok) return amount;

  const date = parseDate(input.date, today);
  if (!date.ok) return date;

  // A named category that does not exist is always an error — filing a taxi
  // under Food silently would be worse than refusing.
  //
  // An OMITTED category is where the two callers part company. The form always
  // supplies one, because its select is never empty, so the fallback is
  // harmless there. An assistant that omits one is guessing, and a guess that
  // lands in the wrong category is invisible — the total is still right, so
  // nothing looks wrong until a budget is read. With `requireCategory` it has
  // to either name one or put the choice in front of the user.
  const requested = input.category ?? null;
  const known = cats.some((c) => c.id === requested);
  const omitted = requested === null || requested === '';

  if (!omitted && !known) {
    return fail(ERR.CATEGORY_UNKNOWN, {
      field: 'category',
      category: requested,
      known: cats.map((c) => c.id),
    });
  }
  if (omitted && requireCategory) {
    return fail(ERR.CATEGORY_REQUIRED, { field: 'category', known: cats.map((c) => c.id) });
  }
  const category = known ? requested : cats[0]?.id ?? '';

  return {
    ok: true,
    value: {
      date: date.value,
      category,
      description,
      amount: amount.value,
      notes: String(input.notes ?? '').trim(),
    },
  };
}

/* ── Duplicates ────────────────────────────────────────────────── */

/**
 * Same thing, same money, same day. Two S$1.40 kopis on one day are perfectly
 * real, which is why this is reported rather than enforced — the caller decides.
 */
export function findDuplicate(expenses = [], candidate) {
  const desc = normaliseDescription(candidate.description);
  return expenses.find(
    (e) =>
      normaliseDescription(e.description) === desc &&
      toCents(e.amount) === toCents(candidate.amount) &&
      e.date === candidate.date
  ) ?? null;
}

/* ── Actions ───────────────────────────────────────────────────── */

/**
 * @param opts.rejectDuplicate  Block instead of warn. The buttons pass false —
 *   a human looking at the list can see the repeat and meant it. The assistant
 *   passes true, so it has to confirm rather than quietly double-charge you.
 * @param opts.source  'manual' | 'assistant'. Recorded on the action so undo
 *   can reverse the assistant's last change without touching yours.
 */
export function addExpense(expenses = [], input = {}, opts = {}) {
  const {
    cats = [], today = '', rejectDuplicate = false, source = 'manual', now, id,
    // Assistant actions must name a category; the form's select always has one.
    requireCategory = source === 'assistant',
  } = opts;

  const checked = validateExpense(input, { cats, today, requireCategory });
  if (!checked.ok) return checked;

  const duplicate = findDuplicate(expenses, checked.value);
  if (duplicate && rejectDuplicate) {
    return fail(ERR.DUPLICATE, { field: 'description', existingId: duplicate.id });
  }

  const expense = { ...checked.value, id: id ?? newExpenseId(now) };
  return {
    ok: true,
    expenses: [...expenses, expense],
    action: { type: 'add', actionId: newActionId(now), source, id: expense.id, expense },
    warnings: duplicate ? [{ code: ERR.DUPLICATE, existingId: duplicate.id }] : [],
  };
}

/** Deletes by id — the only stable handle. Never by description or position. */
export function deleteExpenseById(expenses = [], id, opts = {}) {
  const { source = 'manual' } = opts;
  const index = expenses.findIndex((e) => String(e.id) === String(id));
  if (index === -1) return fail(ERR.NOT_FOUND, { id });

  const expense = expenses[index];
  return {
    ok: true,
    expenses: expenses.filter((_, i) => i !== index),
    // The index travels with the action so undo puts the row back where it was
    // rather than on the end.
    action: { type: 'delete', actionId: newActionId(opts.now), source, id: expense.id, expense, index },
  };
}

/* ── Undo ──────────────────────────────────────────────────────── */

/**
 * Reverses one action. Refuses rather than guesses when the world has moved on
 * underneath it — undoing an add whose row you already deleted by hand would
 * otherwise silently do nothing and report success.
 */
export function revert(expenses = [], action) {
  if (!action) return fail(ERR.NOTHING_TO_UNDO);

  if (action.type === 'add') {
    const current = expenses.find((e) => String(e.id) === String(action.id));
    if (!current) return fail(ERR.ALREADY_REMOVED, { id: action.id });
    // Undo removes a row. If that row is no longer the row the action created —
    // because it was edited afterwards — removing it would throw away an edit
    // that was never part of the action being undone. Refuse and say so.
    if (!sameExpense(current, action.expense)) {
      return fail(ERR.EXPENSE_MODIFIED, { id: action.id, current, original: action.expense });
    }
    return {
      ok: true,
      expenses: expenses.filter((e) => String(e.id) !== String(action.id)),
      undone: action,
    };
  }

  if (action.type === 'delete') {
    const exists = expenses.some((e) => String(e.id) === String(action.id));
    if (exists) return fail(ERR.ALREADY_RESTORED, { id: action.id });
    const at = Math.max(0, Math.min(action.index ?? expenses.length, expenses.length));
    const next = expenses.slice();
    next.splice(at, 0, action.expense);
    return { ok: true, expenses: next, undone: action };
  }

  return fail(ERR.NOTHING_TO_UNDO, { type: action.type });
}

/**
 * Undoes the most recent action, optionally only the most recent one from a
 * given source — which is how "undo what the assistant just did" works without
 * disturbing anything you did yourself in between.
 *
 * Returns a new log with that entry removed. The log is session state, not
 * saved: undo that survived a reload would be a surprise, not a feature.
 */
export function undoLast(expenses = [], log = [], opts = {}) {
  const { source } = opts;
  const at = source
    ? findLastIndex(log, (a) => a.source === source)
    : log.length - 1;
  if (at === -1 || log.length === 0) return fail(ERR.NOTHING_TO_UNDO);

  const result = revert(expenses, log[at]);
  // A failed revert still drops the entry: leaving it would make the next undo
  // retry the same impossible action forever.
  const log2 = log.filter((_, i) => i !== at);
  return result.ok
    ? { ...result, log: log2 }
    : { ...result, log: log2 };
}

/**
 * Field-by-field comparison of the parts a person can edit. Amounts compare in
 * cents so 4.50 and 4.5 are the same expense, which they are.
 */
export function sameExpense(a, b) {
  if (!a || !b) return false;
  return (
    a.date === b.date &&
    a.category === b.category &&
    String(a.description) === String(b.description) &&
    toCents(a.amount) === toCents(b.amount) &&
    String(a.notes ?? '') === String(b.notes ?? '')
  );
}

/** Array.prototype.findLastIndex is recent; this keeps the floor at Node 18. */
function findLastIndex(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i], i)) return i;
  return -1;
}

/** Keeps the undo log from growing without bound in a long session. */
export const LOG_LIMIT = 50;
export const pushAction = (log, action) => [...log, action].slice(-LOG_LIMIT);
