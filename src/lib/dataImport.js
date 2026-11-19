/**
 * Reading a backup file and working out exactly what importing it would do —
 * without doing any of it.
 *
 * Pure, like dataExport.js and for a sharper reason: the preview the user
 * confirms and the write that follows must come from ONE call, or the numbers
 * on screen can differ from what lands on disk. `planImport` returns both the
 * counts and the next state, so the dialog and the commit read the same object.
 *
 * The file is untrusted input. It arrives from a file picker, so it may be
 * truncated, hand-edited, written by a newer build, or hostile. Nothing here
 * throws at the caller: every refusal is a plain message it can show.
 *
 * Writing is in importCommit.js. Nothing in this file touches storage.
 */

import { parseDate, newExpenseId, MAX_DESCRIPTION } from './actions.js';
import { toCents } from './money.js';
import { ownRows, hasSampleRows, planRemove } from './sampleState.js';
import { isKnownTheme, DEFAULT_THEME } from '../themes/themes.js';
import { roastPreferences as normaliseRoastPreferences } from './roastContract.js';
import { BACKUP_FORMAT, SCHEMA_VERSION } from './dataExport.js';

/** Parse guards. A real ledger is orders of magnitude under both. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;

/**
 * Refuse a merged result bigger than this.
 *
 * A CONSERVATIVE GUESS, and deliberately named rather than inlined:
 * browsers commonly allow about 5 MB per origin for localStorage, but the real
 * figure varies by browser, by whether the quota is shared with other storage,
 * and by private-browsing mode — iOS Safari in particular is tighter and can
 * refuse far earlier. 4 MB leaves room for the other ww_* keys and for the
 * fact that localStorage often stores UTF-16, so the bytes on disk can be
 * double what we measure here.
 *
 * UNVERIFIED against any real browser quota. It exists so a large import fails
 * with an explanation instead of a silent half-write; it is not a measurement.
 */
export const MAX_STATE_BYTES = 4 * 1024 * 1024;

/** Bytes, not characters: a character can be up to four bytes of UTF-8. */
export function byteLength(text) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
  // Node without a global TextEncoder; never reached in a browser.
  return Buffer.byteLength(text, 'utf8');
}

const refuse = (message) => ({ ok: false, message });
const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ── Reading the file ──────────────────────────────────────────── */

/**
 * Validates the envelope and nothing else; row-level validation belongs to
 * `planImport`, which needs the local categories to do it.
 *
 * The size check happens BEFORE `JSON.parse`, because parsing a deliberately
 * huge file is the cheapest way to hang the tab, and a parse that has already
 * started cannot be called off.
 */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.trim() === '') return refuse('That file is empty.');

  const bytes = byteLength(text);
  if (bytes > MAX_FILE_BYTES) {
    return refuse(`That file is ${mb(bytes)}, which is too large to be a TallyAI backup. The limit is ${mb(MAX_FILE_BYTES)}.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse('That file is not a TallyAI backup: it is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return refuse('That file is not a TallyAI backup.');
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return refuse('That file is not a TallyAI backup.');
  }
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
    return refuse('This backup was made by a newer version of TallyAI.');
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return refuse('That backup does not say which version it is, so it cannot be read safely.');
  }

  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return refuse('That backup has no data in it.');
  }
  if (!Array.isArray(data.expenses)) {
    return refuse('That backup has no list of transactions in it.');
  }
  if (data.expenses.length > MAX_ROWS) {
    return refuse(`That backup holds ${data.expenses.length.toLocaleString('en-SG')} transactions, more than the ${MAX_ROWS.toLocaleString('en-SG')} this can import at once.`);
  }

  return { ok: true, backup: parsed };
}

/* ── Categories ───────────────────────────────────────────────── */

/**
 * Local categories win on label, missing ones are created.
 *
 * Matching is by **id**, because budgets are keyed on the id: a category the
 * user has renamed locally keeps its local label, or their budget would end up
 * attached to a name they no longer use. Follows the shape of
 * `sampleState.sampleCategories` — categories, a mapping, and what was
 * introduced — so the preview can name the new ones.
 */
export function mergeCategories(localCats = [], backupCats = []) {
  const categories = localCats.map((c) => ({ ...c }));
  const byId = new Map(categories.map((c) => [String(c.id), c]));
  const mapping = {};
  const introducedCategories = [];

  for (const wanted of backupCats) {
    if (!wanted || typeof wanted !== 'object' || wanted.id === undefined || wanted.id === null) continue;
    const key = String(wanted.id);
    const existing = byId.get(key);
    if (existing) {
      // Local label kept on purpose. Only the id has to agree.
      mapping[key] = existing.id;
      continue;
    }
    const created = { id: wanted.id, label: String(wanted.label ?? wanted.id), color: typeof wanted.color === 'string' ? wanted.color : '#888780' };
    categories.push(created);
    byId.set(key, created);
    introducedCategories.push({ ...created });
    mapping[key] = created.id;
  }
  return { categories, mapping, introducedCategories };
}

/* ── Settings ─────────────────────────────────────────────────── */

/**
 * The same normalisations `useAppData` applies on load (src/hooks/useAppData.js
 * lines 31-42), applied here instead, because an imported backup never goes
 * through that load path. Without this, a backup written by an older build
 * could restore the old app name or a theme this build removed.
 */
export function normaliseSettings(data = {}) {
  const appName = typeof data.appName === 'string' && data.appName
    ? (data.appName === 'Expense Tracker' ? 'TallyAI' : data.appName)
    : 'TallyAI';
  return {
    appName,
    theme: typeof data.theme === 'string' && isKnownTheme(data.theme) ? data.theme : DEFAULT_THEME,
    motion: data.motion === 'on' || data.motion === 'auto' ? data.motion : 'auto',
    roastPrefs: normaliseRoastPreferences(data.roastPreferences),
  };
}

/* ── What a stored row may look like ──────────────────────────── */

/**
 * A backup row is accepted if the app could already be storing it, and it is
 * kept EXACTLY as exported.
 *
 * This is deliberately not `validateExpense`. That function enforces today's
 * Add-form rules — an 80-character description cap, trimming, whitespace
 * collapsing and snapping to a whole cent — and the app does not apply any of
 * them to rows it loads: `useAppData` sets the saved array as-is
 * (src/hooks/useAppData.js:31). Rows saved before the action layer arrived
 * (b6d72d6, 2026-10-05) went through `{ ...form, amount: parseFloat(...) }`
 * with a numeric `Date.now()` id (App.jsx:201,207 at c67119e), an unbounded
 * `type="text"` description stored untrimmed, and an amount input with
 * `min="0" step="0.01"` whose step a JS submit handler never enforced. So real
 * ledgers can hold 120-character descriptions, untrimmed text, 4.567 and 0.
 *
 * Validating those with the Add-form rules would reject or silently rewrite
 * them, and a backup re-imported onto the device it came from would report
 * conflicts for rows nobody had touched. So the rule here is representability,
 * not tidiness: reject only what cannot be stored or displayed at all.
 */
export function acceptStoredRow(raw, categoryIds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not_an_object' };

  const id = raw.id;
  if (id !== undefined && id !== null && id !== '' && typeof id !== 'string' && typeof id !== 'number') {
    return { ok: false, reason: 'id_wrong_type', field: 'id' };
  }

  // A missing date is the one thing import will not fill in: `parseDate`
  // defaults it to today (actions.js:121), which would invent spending.
  if (typeof raw.date !== 'string' || raw.date.trim() === '') return { ok: false, reason: 'date_required', field: 'date' };
  const date = parseDate(raw.date, '');
  if (!date.ok || date.value !== raw.date) return { ok: false, reason: 'date_invalid', field: 'date' };

  // Numbers only: every writer the app has ever had ran parseFloat, so a
  // string here means a hand-edited file, and coercing it would change a value.
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount)) {
    return { ok: false, reason: 'amount_invalid', field: 'amount' };
  }

  if (typeof raw.description !== 'string') return { ok: false, reason: 'description_wrong_type', field: 'description' };
  if (raw.notes !== undefined && raw.notes !== null && typeof raw.notes !== 'string') {
    return { ok: false, reason: 'notes_wrong_type', field: 'notes' };
  }

  const category = raw.category;
  if (typeof category !== 'string' && typeof category !== 'number') return { ok: false, reason: 'category_wrong_type', field: 'category' };
  if (!categoryIds.has(String(category))) return { ok: false, reason: 'category_unknown', field: 'category' };

  // Rebuilt from the six known fields, never spread, so __proto__ and any
  // unknown key are dropped. Values are copied, not normalised.
  return {
    ok: true,
    value: {
      date: raw.date,
      category,
      description: raw.description,
      amount: raw.amount,
      notes: raw.notes === undefined || raw.notes === null ? '' : raw.notes,
    },
    /* Unusual but storable, and reported so the preview can say the import
       kept them rather than quietly tidying them. */
    keptAsIs: raw.amount <= 0 || raw.description.length > MAX_DESCRIPTION,
  };
}

/* ── The plan ─────────────────────────────────────────────────── */

const SIX_FIELDS = ['id', 'date', 'category', 'description', 'amount', 'notes'];

/** Same six fields, with the amount compared in whole cents. */
function sameContent(a, b) {
  return a.date === b.date
    && String(a.category) === String(b.category)
    && String(a.description ?? '') === String(b.description ?? '')
    && String(a.notes ?? '') === String(b.notes ?? '')
    && toCents(a.amount) === toCents(b.amount);
}

/**
 * What importing `backup` into `current` would do.
 *
 * Always returns the same shape, so a caller can render counts whether or not
 * the import is allowed; `next` is null when it is refused.
 *
 * Duplicates are judged **by id alone**. The app already decided this: its own
 * `findDuplicate` matches on content but is advisory, because two S$1.40 kopis
 * on one day are real. Matching content here would silently drop genuine
 * repeat purchases, so identical rows with different ids are both kept, and
 * re-importing the same file adds nothing because the ids repeat.
 */
export function planImport(current = {}, backup = {}) {
  const data = backup?.data ?? {};
  const localExpenses = Array.isArray(current.expenses) ? current.expenses : [];
  const localCats = Array.isArray(current.cats) ? current.cats : [];
  const mode = ownRows(localExpenses).length === 0 ? 'full' : 'merge';

  const empty = {
    ok: true, message: '', mode,
    new: 0, duplicates: 0, conflicts: 0, keptAsIs: 0, invalid: [],
    introducedCategories: [], sampleRemoved: 0, settingsChanged: false,
    estimatedBytes: 0, next: null,
  };

  // R2: a full restore onto a device whose only rows are sample rows takes the
  // sample out in the same operation, so demo data cannot survive inside
  // restored real data. Decision 5 already counts such a device as empty.
  let base = { expenses: localExpenses, budgets: current.budgets ?? {}, cats: localCats, mark: current.sampleMark ?? null };
  let sampleRemoved = 0;
  if (mode === 'full' && hasSampleRows(localExpenses, current.sampleMark)) {
    const removed = planRemove({ expenses: localExpenses, budgets: base.budgets, cats: localCats, mark: base.mark });
    sampleRemoved = removed.removed;
    base = { expenses: removed.expenses, budgets: removed.budgets, cats: removed.categories, mark: null };
  }

  // Categories first: rows cannot be validated against a category that does
  // not exist yet, and validateExpense must be able to refuse an unknown one.
  const merged = mergeCategories(base.cats, Array.isArray(data.categories) ? data.categories : []);

  const byId = new Map(base.expenses.map((row) => [String(row.id), row]));
  const kept = [...base.expenses];
  const invalid = [];
  let added = 0, duplicates = 0, conflicts = 0, keptAsIs = 0;

  const categoryIds = new Set(merged.categories.map((c) => String(c.id)));

  for (const [index, raw] of (data.expenses ?? []).entries()) {
    const incomingId = !raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null || raw.id === '' ? null : raw.id;

    const checked = acceptStoredRow(raw, categoryIds);
    if (!checked.ok) {
      invalid.push({ index, id: incomingId, reason: checked.reason, field: checked.field ?? null });
      continue;
    }
    const row = { id: incomingId ?? newExpenseId(), ...checked.value };

    if (incomingId !== null && byId.has(String(incomingId))) {
      const local = byId.get(String(incomingId));
      if (sameContent(local, row)) duplicates += 1;
      else conflicts += 1;          // Local wins: it is the copy the user can see.
      continue;
    }

    kept.push(row);
    byId.set(String(row.id), row);
    added += 1;
    /* Counted only for rows that are actually being added. Counting it at
       validation time made "Nothing new to import" claim it had kept an
       unusual row when it was importing nothing at all. */
    if (checked.keptAsIs) keptAsIs += 1;
  }

  const settings = normaliseSettings(data);
  const next = mode === 'full'
    ? {
      expenses: kept,
      cats: Array.isArray(data.categories) && data.categories.length ? merged.categories : base.cats,
      budgets: data.budgets && typeof data.budgets === 'object' && !Array.isArray(data.budgets) ? { ...data.budgets } : base.budgets,
      sampleMark: null,
      ...settings,
    }
    : { expenses: kept, cats: merged.categories, budgets: base.budgets, sampleMark: current.sampleMark ?? null };

  const estimatedBytes = byteLength(JSON.stringify(next));
  if (estimatedBytes > MAX_STATE_BYTES) {
    return {
      ...empty, mode, invalid, introducedCategories: merged.introducedCategories, sampleRemoved,
      new: added, duplicates, conflicts, keptAsIs, estimatedBytes,
      ok: false,
      message: `Importing this would need about ${mb(estimatedBytes)} of storage on this device, over the ${mb(MAX_STATE_BYTES)} limit. Nothing has been changed.`,
    };
  }

  return {
    ok: true, message: '', mode,
    new: added, duplicates, conflicts, keptAsIs, invalid,
    introducedCategories: merged.introducedCategories,
    sampleRemoved,
    settingsChanged: mode === 'full',
    estimatedBytes,
    next,
  };
}

export { SIX_FIELDS };
