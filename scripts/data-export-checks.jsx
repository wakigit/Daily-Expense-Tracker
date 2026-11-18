import {
  buildBackup, backupJson, deliveryMethod,
  exportableExpenses, backupFilename,
  SCHEMA_VERSION, BACKUP_FORMAT,
} from '../src/lib/dataExport';
import { SAMPLE_PREFIX } from '../src/lib/sampleData';

/**
 * Export checks. Fictional data only, invented here, nothing from the eval
 * fixture and nothing from anyone's real ledger.
 *
 * The CSV cases are asserted as exact strings rather than "contains", because
 * every bug this file exists to catch is a byte-level one: a missing BOM, an LF
 * where a CRLF belongs, a quote that was not doubled, or an apostrophe that
 * went outside the quotes instead of inside them.
 */

const CATS = [
  { id: 'food', label: 'Food & Drinks', color: '#D85A30' },
  { id: 'pub', label: 'Public Transport', color: '#378ADD' },
  { id: 'misc', label: 'Others', color: '#888780' },
];

const ROWS = [
  { id: 'e-1', date: '2026-11-02', category: 'food', description: 'Kopi and toast', amount: 4.8, notes: '' },
  { id: 17, date: '2026-11-04', category: 'pub', description: 'MRT top up', amount: 12, notes: 'legacy numeric id' },
  { id: 'e-3', date: '2026-11-07', category: 'misc', description: 'Stationery', amount: 5.25, notes: '' },
];

const STATE = {
  expenses: ROWS,
  cats: CATS,
  budgets: { food: 200, pub: 50 },
  appName: 'TallyAI',
  theme: 'forest',
  motion: 'auto',
  roastPrefs: { enabled: true, name: '', singapore: true, smu: true },
  sampleMark: { version: 2, rowCount: 40 },
  roastSeed: { cached: 'something' },
  roastCache: { cached: 'something' },
};

const NOW = new Date(2026, 10, 18, 7, 35);

export function dataExportChecks(logic) {
  /* ── Envelope ──────────────────────────────────────────────── */
  const b = buildBackup(STATE, { now: NOW });
  logic('export: envelope format', b.format, BACKUP_FORMAT);
  logic('export: schema version is 1', b.schemaVersion, SCHEMA_VERSION);
  logic('export: schema version is a number, not a string', typeof b.schemaVersion, 'number');
  logic('export: app name stamped', b.app, 'TallyAI');
  logic('export: exportedAt is an ISO instant', b.exportedAt, NOW.toISOString());
  logic('export: envelope keys are exactly these', Object.keys(b).sort(),
    ['app', 'data', 'exportedAt', 'format', 'schemaVersion']);
  logic('export: data keys are exactly these', Object.keys(b.data).sort(),
    ['appName', 'budgets', 'categories', 'expenses', 'motion', 'roastPreferences', 'theme']);

  /* ── Exclusions ────────────────────────────────────────────── */
  logic('export: sampleMark is never exported', 'sampleMark' in b.data, false);
  logic('export: roastCache is never exported', 'roastCache' in b.data, false);
  logic('export: no key anywhere mentions the roast cache', backupJson(STATE, { now: NOW }).includes('roastCache'), false);

  const withSample = {
    ...STATE,
    expenses: [...ROWS, { id: `${SAMPLE_PREFIX}x1`, date: '2026-11-09', category: 'food', description: 'Sample lunch', amount: 9.9, notes: '' }],
  };
  logic('export: sample rows are excluded from the backup', buildBackup(withSample, { now: NOW }).data.expenses.length, 3);
  logic('export: real rows survive alongside a sample row', exportableExpenses(withSample.expenses).map((e) => e.id), ['e-1', 17, 'e-3']);

  /* ── Fidelity ──────────────────────────────────────────────── */
  logic('export: amounts are unchanged, not re-rounded', b.data.expenses.map((e) => e.amount), [4.8, 12, 5.25]);
  logic('export: a legacy numeric id is exported as a number, not stringified',
    b.data.expenses.map((e) => typeof e.id), ['string', 'number', 'string']);
  logic('export: rows survive a JSON round trip exactly',
    JSON.parse(backupJson(STATE, { now: NOW })).data.expenses, ROWS);
  logic('export: budgets are carried', b.data.budgets, { food: 200, pub: 50 });
  logic('export: categories are carried whole', b.data.categories, CATS);
  logic('export: an unknown motion value falls back to auto', buildBackup({ ...STATE, motion: 'wobble' }).data.motion, 'auto');
  logic('export: a missing state still produces a valid envelope', buildBackup().data.expenses, []);

  /* ── Filenames ─────────────────────────────────────────────── */
  logic('export: backup filename uses local date and time', backupFilename(NOW), 'tallyai-backup-2026-11-18-0735.json');
  logic('export: filename pads single-digit parts', backupFilename(new Date(2026, 0, 5, 9, 4)), 'tallyai-backup-2026-01-05-0904.json');

  /* ── Delivery ──────────────────────────────────────────────── */
  logic('delivery: normal browser downloads', deliveryMethod({ standalone: false, canShareFiles: false }), 'download');
  logic('delivery: normal browser downloads even when sharing exists', deliveryMethod({ standalone: false, canShareFiles: true }), 'download');
  logic('delivery: standalone with file sharing shares', deliveryMethod({ standalone: true, canShareFiles: true }), 'share');
  logic('delivery: standalone without file sharing falls back to text', deliveryMethod({ standalone: true, canShareFiles: false }), 'text');
  logic('delivery: no environment given behaves like a browser tab', deliveryMethod(), 'download');
}
