import { assistantReliabilityChecks } from './assistant-reliability-checks';
import { voiceMoneyChecks } from './voice-money-checks';
import { queryChecks } from './query-checks';
/* Temporary smoke test: render every view to a string and assert key content.
   Catches bad props, typos and crashes without needing a browser. */
import { recentPreview } from '../src/lib/recentPreview';
import { roastChecks } from './roast-checks';
import { renderToString } from 'react-dom/server';
import { comparisonRanges, comparisonAnswer } from '../src/lib/comparison';
import ComparisonEvidence from '../src/components/ComparisonEvidence';
import HomeView from '../src/views/HomeView';
import CategoryView from '../src/views/CategoryView';
import OverviewView from '../src/views/OverviewView';
import AddView from '../src/views/AddView';
import SettingsView from '../src/views/SettingsView';
import MonthSheet from '../src/components/MonthSheet';
import SwipeRow from '../src/components/SwipeRow';
import SearchBar from '../src/components/SearchBar';
import Toast from '../src/components/Toast';
import Donut from '../src/components/Donut';
import AnswerEvidence from '../src/components/AnswerEvidence';
import { evidenceIsOutdated, markOutdatedAnswers } from '../src/lib/answerEvidence';
import BottomNav from '../src/components/BottomNav';
import Header from '../src/components/Header';
import { DEF_CATS } from '../src/themes/themes';
import { matchesQuery, sortExpenses, filterAndSort } from '../src/lib/search';
import { parseUtterance } from '../src/lib/parseUtterance';
import { answer } from '../src/lib/ask';
import * as St from '../src/lib/stats';
import { paintBackground, setSceneDecay, setScenePaused, setSceneStill, travel } from '../src/themes/scenes';
import { THEMES, isKnownTheme, themeById, DEFAULT_THEME } from '../src/themes/themes';
import { budgetStatus, decayLevel } from '../src/lib/status';
import WeekBars from '../src/components/WeekBars';
import MonthTrend from '../src/components/MonthTrend';
import { monthTrend, daysInMonth, niceCeil, axisTicks } from '../src/lib/trend';
import {
  buildSample, patternTotalThrough, sampleTotal, isSampleRow,
  SAMPLE_BUDGETS, SAMPLE_BUDGET_TOTAL, PATTERN_TOTAL, OVER_BUDGET_FROM_DAY,
} from '../src/lib/sampleData';
import { planLoad, planRemove, hasSampleRows } from '../src/lib/sampleState';
import {
  newExpenseId, parseAmount, parseDate, validateExpense, findDuplicate,
  addExpense, deleteExpenseById, revert, undoLast, pushAction, sameExpense, ERR, LOG_LIMIT,
} from '../src/lib/actions';
import { toCents, fromCents, sumAmounts } from '../src/lib/money';
import { today, curYm, money, dayLabel } from '../src/lib/format';
import { validateIntent, buildContext, INTENT_ERR } from '../src/lib/intent';
import { planFromIntent } from '../src/lib/assistant';
import { requestIntent as requestIntentFromBackend, explainIntentFailure } from '../src/lib/assistantClient';
import {
  validateReceipt, receiptToFields, mergeReceiptIntoForm, printedTotal, describeMissing, RECEIPT_ERR,
} from '../src/lib/receipt';
import { fit } from '../src/lib/receiptImage';
import { requestReceipt as requestReceiptFromBackend, explainFailure } from '../src/lib/receiptClient';

const cats = DEF_CATS;
const catById = (id) => cats.find((c) => c.id === id);
const expenses = [
  { id: 1, date: '2026-09-28', category: 'food', description: 'Chicken rice', amount: 4.5, notes: '' },
  { id: 2, date: '2026-09-27', category: 'hire', description: 'Grab to Orchard', amount: 13.2, notes: 'split' },
  { id: 3, date: '2026-09-20', category: 'shop', description: 'Uniqlo tee', amount: 29.9, notes: '' },
];
// Six rows crosses SEARCH_THRESHOLD, so the search bar should appear.
const manyExpenses = [
  ...expenses,
  { id: 4, date: '2026-09-19', category: 'pub', description: 'EZ-Link top up', amount: 20, notes: '' },
  { id: 5, date: '2026-09-18', category: 'food', description: 'Kopi', amount: 1.4, notes: '' },
  { id: 6, date: '2026-09-17', category: 'misc', description: 'Stamps', amount: 3.2, notes: '' },
];
const budgets = { food: 300, hire: 100, pub: 60, shop: 150, needs: 80, misc: 50 };
const spending = { food: 4.5, hire: 13.2, pub: 0, shop: 29.9, needs: 0, misc: 0 };
const chartData = cats.filter((c) => spending[c.id] > 0)
  .map((c) => ({ id: c.id, name: c.label, value: spending[c.id], color: c.color }));
const txn = { catById, onDelete() {}, onEdit() {} };

const checks = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const run = (name, el, ...must) => {
  try {
    const html = renderToString(el);
    const missing = must.filter((m) => !html.includes(m));
    checks.push({ name, ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : `${html.length} chars` });
  } catch (err) {
    checks.push({ name, ok: false, detail: `THREW: ${err.message}` });
  }
};

const home = { ym: '2026-10', onPickCat: () => {}, onAddFirst: () => {}, ...txn };

run('HomeView', <HomeView
  totalSpent={47.6} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={expenses} {...home} />,
  'S$47.60', 'Chicken rice', 'Where it went', 'donut-slice', 'swipe-wrap', 'swipe-delete');

run('HomeView hero states the budget plainly', <HomeView
  totalSpent={47.6} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={expenses} {...home} />,
  'Spent in ', 'October', 'S$740.00', 'On track', 'hero-tick', 'status-chip');

run('HomeView over budget', <HomeView
  totalSpent={900} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={[]} {...home} />,
  'Over budget', 'S$160.00', 'hero-bar-fill over');

run('HomeView empty', <HomeView
  totalSpent={0} totalBudget={0}
  chartData={[]} cats={cats} budgets={{}} spending={{}}
  monthExp={[]} {...home} />,
  'Nothing logged for ', 'October', 'Add your first expense', 'No budget set');

run('CategoryView', <CategoryView
  cat={cats[0]} ym="2026-09" items={expenses} total={47.6}
  byMonth={[['2026-09', expenses]]} {...txn} />,
  'September 2026', 'total', 'Transactions');

run('CategoryView empty', <CategoryView
  cat={cats[0]} ym="2026-10" items={[]} total={0} byMonth={[]} {...txn} />,
  'No ', 'entries in ', 'October 2026', 'S$0.00');

const overview = { onPickMonth: () => {}, onAddToMonth: () => {} };

run('OverviewView', <OverviewView
  histByYear={[['2026', ['2026-09', '2026-08']]]}
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  ym="2026-09" totalBudget={740} hasExpenses {...overview} />,
  '2026', 'September 2026', '3 transactions');

// A past month has to look writable, not archived.
run('OverviewView says a month is editable', <OverviewView
  histByYear={[['2026', ['2026-09', '2026-08']]]}
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  ym="2026-09" totalBudget={740} hasExpenses {...overview} />,
  'row-add', 'Add to ', 'VIEWING', 'Open September 2026');

run('OverviewView empty', <OverviewView
  histByYear={[]} monthTotals={() => ({ spent: 0, count: 0 })}
  ym="2026-09" totalBudget={0} hasExpenses={false} {...overview} />,
  'Nothing to show yet');

run('AddView new', <AddView
  form={{ date: '2026-09-30', category: 'food', description: '', amount: '', notes: '' }}
  setField={() => () => {}} errors={{}} cats={cats} editId={null} today="2026-09-30"
  onSubmit={() => {}} onCancel={() => {}} onScanned={() => {}} />,
  'New expense', 'Amount (SGD)', 'Add expense', 'Scan a receipt');

run('AddView edit + errors', <AddView
  form={{ date: '2026-09-30', category: 'food', description: '', amount: '', notes: '' }}
  setField={() => () => {}} errors={{ description: true, amount: true }} cats={cats} editId={7}
  today="2026-09-30" onSubmit={() => {}} onCancel={() => {}} onScanned={() => {}} />,
  'Edit expense', 'Save changes', 'highlighted fields', 'class="err"');

run('SettingsView', <SettingsView
  themeId="forest" onTheme={() => {}} motion="auto" onMotion={() => {}}
  appName="TallyAI" onAppName={() => {}}
  cats={cats} budDraft={budgets} onBudDraft={() => {}} onSaveBudgets={() => {}} saved={false}
  delCatId="food" onAskDelCat={() => {}} onDelCat={() => {}}
  newCat={{ label: '', color: '#D85A30' }} onNewCat={() => {}} onAddCat={() => {}} />,
  'Moonlit Forest', 'Rainy City', 'Animate the wallpaper', 'role="switch"', 'aria-checked="false"', 'Total monthly budget', 'S$740.00',
  'will be deleted', 'Add new category', 'Selected',
  // The sample card survives a missing `sample` prop and offers the load.
  'Sample data', 'Load sample data');

/* Both states of the sample card, and the labelling that keeps it honest. */
run('SettingsView sample not loaded', <SettingsView
  themeId="forest" onTheme={() => {}} motion="auto" onMotion={() => {}}
  appName="TallyAI" onAppName={() => {}}
  cats={cats} budDraft={budgets} onBudDraft={() => {}} onSaveBudgets={() => {}} saved={false}
  delCatId={null} onAskDelCat={() => {}} onDelCat={() => {}}
  newCat={{ label: '', color: '#D85A30' }} onNewCat={() => {}} onAddCat={() => {}}
  sample={{ loaded: false, rowCount: 0, ownRows: 2, hasBudgets: true }} />,
  'Load sample data', 'Demonstration figures only', 'can be removed again',
  'run-down state', 'S$320.00');

run('SettingsView sample loaded', <SettingsView
  themeId="forest" onTheme={() => {}} motion="auto" onMotion={() => {}}
  appName="TallyAI" onAppName={() => {}}
  cats={cats} budDraft={budgets} onBudDraft={() => {}} onSaveBudgets={() => {}} saved={false}
  delCatId={null} onAskDelCat={() => {}} onDelCat={() => {}}
  newCat={{ label: '', color: '#D85A30' }} onNewCat={() => {}} onAddCat={() => {}}
  sample={{ loaded: true, rowCount: 67, ownRows: 2, months: 'September 2026 and October 2026' }} />,
  'Sample data is loaded', '67', 'None of it is real', 'Remove sample data',
  'September 2026 and October 2026');

run('MonthSheet', <MonthSheet
  histByYear={[['2026', ['2026-09']]]} ym="2026-09"
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  onPick={() => {}} onClose={() => {}} />,
  'Select month', 'entries', 'aria-modal');

run('Donut single slice', <Donut data={[{ id: 'a', value: 10, color: '#f00' }]} total={10} />, 'S$10.00', 'path');
run('Donut many slices', <Donut data={chartData} total={47.6} />, 'donut-slice', 'Total');
run('BottomNav', <BottomNav tab="add" onGo={() => {}} />,
  'aria-current="page"', 'Overview', 'Settings', 'nav-btn active raised');
run('Header month mode', <Header ym="2026-09" onOpenPicker={() => {}} />,
  'September 2026', 'Change month');
run('Header page title', <Header title="Budget" onOpenSettings={() => {}} />, 'page-title', 'Budget');
run('Header filter mode', <Header filteredCat={cats[0]} onClearFilter={() => {}} ym="2026-09" onOpenPicker={() => {}} />, 'Food');

run('HomeView with search bar', <HomeView
  totalSpent={72.2} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={manyExpenses} {...home} />,
  'Search transactions', 'sort-btn', 'EZ-Link top up');

run('HomeView no search bar under threshold', <HomeView
  totalSpent={47.6} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={expenses} {...home} />,
  'Chicken rice');

run('CategoryView with search', <CategoryView
  cat={cats[0]} ym="2026-09" items={manyExpenses} total={72.2}
  byMonth={[['2026-09', manyExpenses]]} {...txn} />,
  'Search transactions', 'September 2026', 'total');

run('SwipeRow closed', <SwipeRow open={false} onOpenChange={() => {}} onDelete={() => {}}><span>row</span></SwipeRow>,
  'swipe-wrap', 'translate3d(0px,0,0)', 'tabindex="-1"');

run('SwipeRow open', <SwipeRow open onOpenChange={() => {}} onDelete={() => {}}><span>row</span></SwipeRow>,
  'active', 'translate3d(-88px,0,0)', 'Delete');

run('SearchBar idle', <SearchBar query="" onQuery={() => {}} sort="date" onSort={() => {}}
  matchCount={6} sourceCount={6} isFiltering={false} />, 'Newest', 'Search transactions');

run('SearchBar filtering', <SearchBar query="kopi" onQuery={() => {}} sort="amount" onSort={() => {}}
  matchCount={1} sourceCount={6} isFiltering />, 'Highest', 'Clear search', '1 of 6');

run('SearchBar no matches', <SearchBar query="zzz" onQuery={() => {}} sort="amount-asc" onSort={() => {}}
  matchCount={0} sourceCount={6} isFiltering />, 'No matches', 'Lowest');

run('Toast plain', <Toast message="Budgets saved" />, 'Budgets saved', 'role="status"');
run('Toast with undo', <Toast message="Entry deleted" actions={[{ key: 'undo', label: 'Undo', onClick: () => {} }]} />, 'Undo', 'toast-action');
run('Toast hidden', <Toast message="" />, '');

/* ── Pure logic tests (no React) ───────────────────────────────── */

const logic = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  checks.push({ name, ok, detail: ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}` });
};

const e1 = expenses[0]; // Chicken rice, food, 4.5
const e2 = expenses[1]; // Grab to Orchard, hire, 13.2, notes "split"

logic('match: empty query matches all', matchesQuery(e1, '', 'Food'), true);
logic('match: description substring', matchesQuery(e1, 'chick', 'Food'), true);
logic('match: case insensitive', matchesQuery(e1, 'CHICKEN', 'Food'), true);
logic('match: notes', matchesQuery(e2, 'split', 'Private hire'), true);
logic('match: category label', matchesQuery(e2, 'private', 'Private hire'), true);
logic('match: amount as string', matchesQuery(e2, '13.2', 'Private hire'), true);
logic('match: no false positive', matchesQuery(e1, 'zzzz', 'Food'), false);
logic('match: whitespace-only query matches all', matchesQuery(e1, '   ', 'Food'), true);
logic('match: missing notes does not throw',
  matchesQuery({ description: 'x', amount: 1 }, 'x', ''), true);

logic('sort: newest first',
  sortExpenses(expenses, 'date').map((e) => e.id), [1, 2, 3]);
logic('sort: highest amount',
  sortExpenses(expenses, 'amount').map((e) => e.id), [3, 2, 1]);
logic('sort: lowest amount',
  sortExpenses(expenses, 'amount-asc').map((e) => e.id), [1, 2, 3]);
logic('sort: does not mutate input',
  (() => { const copy = [...manyExpenses]; sortExpenses(manyExpenses, 'amount'); return manyExpenses.map(e=>e.id).join() === copy.map(e=>e.id).join(); })(), true);

// 'k' hits Chicken rice (4.50), EZ-Link top up (20.00) and Kopi (1.40) only,
// so this checks filtering and amount-desc ordering at the same time.
logic('filterAndSort: query + sort together',
  filterAndSort(manyExpenses, 'k', 'amount', catById).map((e) => e.id), [4, 1, 5]);
logic('filterAndSort: broad query matches via category label',
  filterAndSort(manyExpenses, 'o', 'amount', catById).length, 6);
logic('filterAndSort: empty result',
  filterAndSort(manyExpenses, 'nothinghere', 'date', catById), []);
logic('filterAndSort: works without catById',
  filterAndSort(expenses, 'kopi', 'date', undefined), []);

/* ── Shared expense actions (lib/actions.js) ───────────────────── */

const AC_CATS = [{ id: 'food', label: 'Food' }, { id: 'shop', label: 'Shopping' }];
const AC_TODAY = '2026-10-05';
const acOpts = { cats: AC_CATS, today: AC_TODAY };
const base = [
  { id: 'a1', date: '2026-10-01', category: 'food', description: 'Chicken rice', amount: 4.5, notes: '' },
  { id: 'a2', date: '2026-10-02', category: 'shop', description: 'Tee', amount: 29.9, notes: '' },
];

/* Ids must be unique even when two adds land in the same millisecond — the
   old Date.now() scheme could not promise that, and an assistant filing a
   receipt does exactly that. */
const idsSameMs = Array.from({ length: 50 }, () => newExpenseId(1760000000000));
logic('id: unique within one millisecond', new Set(idsSameMs).size, 50);
logic('id: a string, so it never collides with a legacy numeric id',
  typeof newExpenseId(1), 'string');

/* ── Amounts ── */
logic('amount: plain decimal', parseAmount('4.50').value, 4.5);
logic('amount: number input', parseAmount(4.5).value, 4.5);
logic('amount: strips S$ and commas', parseAmount('S$1,234.50').value, 1234.5);
logic('amount: rounds to cents', parseAmount('4.567').value, 4.57);
logic('amount: empty is "required", not "invalid"', parseAmount('').error.code, ERR.AMOUNT_REQUIRED);
logic('amount: letters rejected', parseAmount('abc').error.code, ERR.AMOUNT_INVALID);
logic('amount: two decimal points rejected', parseAmount('12.3.4').error.code, ERR.AMOUNT_INVALID);
logic('amount: exponent rejected', parseAmount('1e5').error.code, ERR.AMOUNT_INVALID);
logic('amount: zero rejected', parseAmount('0').error.code, ERR.AMOUNT_NOT_POSITIVE);
logic('amount: negative rejected', parseAmount('-5').error.code, ERR.AMOUNT_NOT_POSITIVE);
logic('amount: NaN rejected', parseAmount(NaN).error.code, ERR.AMOUNT_INVALID);
logic('amount: Infinity rejected', parseAmount(Infinity).error.code, ERR.AMOUNT_INVALID);
logic('amount: above the ceiling rejected', parseAmount('2000000').error.code, ERR.AMOUNT_TOO_LARGE);
logic('amount: the error names the field', parseAmount('abc').error.field, 'amount');

/* ── Dates and categories ── */
logic('date: defaults to today when omitted', parseDate('', AC_TODAY).value, AC_TODAY);
logic('date: 31 February rejected', parseDate('2026-02-31', AC_TODAY).error.code, ERR.DATE_INVALID);
logic('date: wrong format rejected', parseDate('5/10/2026', AC_TODAY).error.code, ERR.DATE_INVALID);
logic('date: a real date passes', parseDate('2026-02-28', AC_TODAY).value, '2026-02-28');
logic('category: unknown is an error, not a silent default',
  validateExpense({ description: 'x', amount: '1', category: 'nope' }, acOpts).error.code,
  ERR.CATEGORY_UNKNOWN);
logic('category: omitted falls back to the first',
  validateExpense({ description: 'x', amount: '1' }, acOpts).value.category, 'food');
logic('description: required', validateExpense({ amount: '1' }, acOpts).error.code, ERR.DESCRIPTION_REQUIRED);
logic('description: whitespace only is still missing',
  validateExpense({ description: '   ', amount: '1' }, acOpts).error.code, ERR.DESCRIPTION_REQUIRED);
logic('description: inner whitespace collapses',
  validateExpense({ description: 'chicken   rice', amount: '1' }, acOpts).value.description, 'chicken rice');
logic('description: over the limit rejected',
  validateExpense({ description: 'x'.repeat(200), amount: '1' }, acOpts).error.code, ERR.DESCRIPTION_TOO_LONG);

/* ── Duplicates ── */
const dupCandidate = { description: 'chicken RICE', amount: 4.5, date: '2026-10-01' };
logic('duplicate: matches ignoring case and spacing', findDuplicate(base, dupCandidate)?.id, 'a1');
logic('duplicate: a different day is not a duplicate',
  findDuplicate(base, { ...dupCandidate, date: '2026-10-03' }), null);
logic('duplicate: a different amount is not a duplicate',
  findDuplicate(base, { ...dupCandidate, amount: 5 }), null);

// The form allows repeats — two kopis in a day are real and you can see the list.
const dupAllowed = addExpense(base, { description: 'Chicken rice', amount: '4.50', category: 'food', date: '2026-10-01' }, { ...acOpts });
logic('duplicate: manual add is allowed', dupAllowed.ok, true);
logic('duplicate: but it is reported as a warning', dupAllowed.warnings[0].code, ERR.DUPLICATE);
logic('duplicate: warning points at the row it matched', dupAllowed.warnings[0].existingId, 'a1');

// The assistant has to ask rather than quietly double-charge.
const dupBlocked = addExpense(base, { description: 'Chicken rice', amount: '4.50', category: 'food', date: '2026-10-01' }, { ...acOpts, rejectDuplicate: true });
logic('duplicate: assistant add is blocked', dupBlocked.ok, false);
logic('duplicate: blocked with the duplicate code', dupBlocked.error.code, ERR.DUPLICATE);
logic('duplicate: tells the caller which row already exists', dupBlocked.error.existingId, 'a1');

/* ── Add ── */
const added = addExpense(base, { description: 'Kopi', amount: 'S$1.40', category: 'food' }, { ...acOpts, id: 'new1', source: 'assistant' });
logic('add: succeeds', added.ok, true);
logic('add: leaves the input array alone', base.length, 2);
logic('add: appends one row', added.expenses.length, 3);
logic('add: normalises the amount', added.expenses[2].amount, 1.4);
logic('add: dates it today when unsaid', added.expenses[2].date, AC_TODAY);
logic('add: records a reversible action', [added.action.type, added.action.source, added.action.id],
  ['add', 'assistant', 'new1']);
logic('add: a bad amount stops the whole thing',
  addExpense(base, { description: 'x', amount: 'abc' }, acOpts).ok, false);
logic('add: a rejected add changes nothing',
  addExpense(base, { description: 'x', amount: 'abc' }, acOpts).expenses, undefined);

/* ── Delete by id ── */
const deleted = deleteExpenseById(base, 'a1', { source: 'assistant' });
logic('delete: succeeds by id', deleted.ok, true);
logic('delete: removes exactly one row', deleted.expenses.length, 1);
logic('delete: removes the right row', deleted.expenses[0].id, 'a2');
logic('delete: leaves the input array alone', base.length, 2);
logic('delete: remembers where it was', deleted.action.index, 0);
logic('delete: unknown id is an error, not a no-op', deleteExpenseById(base, 'nope').error.code, ERR.NOT_FOUND);
// Legacy rows have numeric ids; a model will hand back the string form.
logic('delete: matches a numeric legacy id given as a string',
  deleteExpenseById([{ id: 1760000000000, description: 'old', amount: 1, date: AC_TODAY, category: 'food' }], '1760000000000').ok,
  true);

/* ── Undo after add ── */
const undoneAdd = revert(added.expenses, added.action);
logic('undo add: succeeds', undoneAdd.ok, true);
logic('undo add: returns the list to where it started', undoneAdd.expenses.length, 2);
logic('undo add: removes the row it added',
  undoneAdd.expenses.some((e) => e.id === 'new1'), false);
logic('undo add: refuses when the row is already gone',
  revert(base, added.action).error.code, ERR.ALREADY_REMOVED);

/* ── Undo after delete ── */
const undoneDel = revert(deleted.expenses, deleted.action);
logic('undo delete: succeeds', undoneDel.ok, true);
logic('undo delete: puts the row back', undoneDel.expenses.length, 2);
// Position matters: appending would silently reorder the list on every undo.
logic('undo delete: puts it back where it was', undoneDel.expenses[0].id, 'a1');
logic('undo delete: refuses when the row is already there',
  revert(base, deleted.action).error.code, ERR.ALREADY_RESTORED);
logic('undo: nothing to undo is an error, not a crash', revert(base, null).error.code, ERR.NOTHING_TO_UNDO);

/* ── Undo the last ASSISTANT action specifically ── */
const mixedAdd = addExpense(base, { description: 'Bot row', amount: '2', category: 'food' }, { ...acOpts, id: 'bot1', source: 'assistant' });
const mixedThenManual = addExpense(mixedAdd.expenses, { description: 'My row', amount: '3', category: 'food' }, { ...acOpts, id: 'me1', source: 'manual' });
const log = [mixedAdd.action, mixedThenManual.action];

const undoBot = undoLast(mixedThenManual.expenses, log, { source: 'assistant' });
logic('undo assistant: succeeds past a later manual action', undoBot.ok, true);
logic('undo assistant: removes the assistant row', undoBot.expenses.some((e) => e.id === 'bot1'), false);
logic('undo assistant: leaves the manual row alone', undoBot.expenses.some((e) => e.id === 'me1'), true);
logic('undo assistant: drops that entry from the log', undoBot.log.length, 1);
logic('undo assistant: nothing of its own to undo',
  undoLast(base, [mixedThenManual.action], { source: 'assistant' }).error.code, ERR.NOTHING_TO_UNDO);
logic('undo last: with no source, takes the most recent',
  undoLast(mixedThenManual.expenses, log).undone.id, 'me1');
logic('undo last: an empty log is an error', undoLast(base, []).error.code, ERR.NOTHING_TO_UNDO);
// A revert that cannot apply still drops its entry, or undo would retry it forever.
logic('undo last: a stale entry is dropped even when it fails',
  undoLast(base, [mixedAdd.action]).log.length, 0);

/* ── The log is bounded ── */
let bigLog = [];
for (let i = 0; i < 120; i++) bigLog = pushAction(bigLog, { type: 'add', id: `x${i}`, source: 'manual' });
logic('log: capped', bigLog.length, LOG_LIMIT);
logic('log: keeps the newest', bigLog[bigLog.length - 1].id, 'x119');

/* ── Foundation: the Singapore calendar day ────────────────────── */

/* Singapore is UTC+8 with no DST, so for the eight hours after local midnight
   the UTC date is still yesterday. toISOString().slice(0,10) — what today()
   used to be — dated every one of those expenses to the wrong day. */
const atUtc = (iso) => new Date(iso);

logic('today: 00:30 in Singapore is already the new day',
  today(atUtc('2026-10-05T16:30:00Z')), '2026-10-06');
logic('today: and UTC still says yesterday then',
  atUtc('2026-10-05T16:30:00Z').toISOString().slice(0, 10), '2026-10-05');
logic('today: 03:00 Singapore, mid-window',
  today(atUtc('2026-10-05T19:00:00Z')), '2026-10-06');
logic('today: 07:59 Singapore, last minute of the window',
  today(atUtc('2026-10-05T23:59:00Z')), '2026-10-06');
logic('today: 08:00 Singapore, where UTC catches up',
  today(atUtc('2026-10-06T00:00:00Z')), '2026-10-06');
logic('today: midday agrees with UTC', today(atUtc('2026-10-06T04:00:00Z')), '2026-10-06');
logic('today: rolls the month', today(atUtc('2026-10-31T17:00:00Z')), '2026-11-01');
logic('today: rolls the year', today(atUtc('2026-12-31T17:00:00Z')), '2027-01-01');
logic('curYm: follows the Singapore day across a year boundary',
  curYm(atUtc('2026-12-31T17:00:00Z')), '2027-01');

// An expense logged at 1am with no date given lands on the day it felt like.
const lateNight = addExpense([], { description: 'Supper', amount: '6.50', category: 'food' },
  { cats: AC_CATS, today: today(atUtc('2026-10-05T17:00:00Z')) });
logic('add: a 1am expense is dated today in Singapore, not yesterday in UTC',
  lateNight.expenses[0].date, '2026-10-06');

/* The voice path dates expenses too: "yesterday" said at 1am must mean
   yesterday in Singapore, not two days back in UTC. */
// 2026-10-05T17:00Z is 01:00 on the 6th in Singapore, so "yesterday" is the
// 5th. Computed from UTC it would have been the 4th — a day adrift.
logic('voice: "yesterday" at 1am follows the Singapore day',
  parseUtterance('spent 5 dollars on coffee yesterday', AC_CATS, atUtc('2026-10-05T17:00:00Z')).date,
  '2026-10-05');
logic('voice: and from midday, where UTC and Singapore agree on the day',
  parseUtterance('spent 5 dollars on coffee yesterday', AC_CATS, atUtc('2026-10-06T04:00:00Z')).date,
  '2026-10-05');

/* ── Foundation: undo must not clobber a later edit ────────────── */

/* The sequence that matters: the assistant adds a row, you correct it by hand,
   then you undo the assistant. Removing the row would throw away your edit,
   and it would do it silently — the row simply disappears. */
const botAdd = addExpense(base, { description: 'Grab', amount: '12.00', category: 'shop' },
  { ...acOpts, id: 'bot9', source: 'assistant' });
const editedByHand = botAdd.expenses.map((e) =>
  e.id === 'bot9' ? { ...e, amount: 18.5, description: 'Grab to airport' } : e);

const refused = revert(editedByHand, botAdd.action);
logic('undo after edit: refuses', refused.ok, false);
logic('undo after edit: says why', refused.error.code, ERR.EXPENSE_MODIFIED);
logic('undo after edit: the edited row is still there',
  editedByHand.some((e) => e.id === 'bot9'), true);
logic('undo after edit: reports both versions so a caller can explain',
  [refused.error.original.amount, refused.error.current.amount], [12, 18.5]);

// Untouched, it still undoes cleanly — the guard is not just refusing always.
logic('undo without an edit: still works', revert(botAdd.expenses, botAdd.action).ok, true);
// A note added by hand counts as an edit too.
const notedByHand = botAdd.expenses.map((e) => (e.id === 'bot9' ? { ...e, notes: 'work trip' } : e));
logic('undo after only a note was added: refuses',
  revert(notedByHand, botAdd.action).error.code, ERR.EXPENSE_MODIFIED);
logic('sameExpense: 4.50 and 4.5 are the same row',
  sameExpense({ date: 'd', category: 'c', description: 'x', amount: 4.5, notes: '' },
              { date: 'd', category: 'c', description: 'x', amount: 4.50, notes: '' }), true);
logic('sameExpense: a changed amount is a different row',
  sameExpense({ date: 'd', category: 'c', description: 'x', amount: 4.5 },
              { date: 'd', category: 'c', description: 'x', amount: 4.6 }), false);

// 4.50 and 4.5 are the same expense, not an edit.
const reformatted = botAdd.expenses.map((e) => (e.id === 'bot9' ? { ...e, amount: 12.0 } : e));
logic('undo: a cosmetically different amount is not an edit',
  revert(reformatted, botAdd.action).ok, true);

// undoLast surfaces the same refusal rather than pretending it worked.
const editLog = [botAdd.action];
const undoEdited = undoLast(editedByHand, editLog, { source: 'assistant' });
logic('undoLast: reports the refusal', undoEdited.error.code, ERR.EXPENSE_MODIFIED);
logic('undoLast: leaves the edited row alone', undoEdited.expenses, undefined);

/* ── Foundation: money in integer cents ────────────────────────── */

/* The claim "rounding to 2dp makes sums exact" is false; these are the cases
   that disprove it, and the cases cents get right. */
logic('float addition really is inexact (0.1 + 0.2)', 0.1 + 0.2 === 0.3, false);
logic('cents: 0.1 + 0.2 sums to exactly 0.3',
  sumAmounts([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
logic('cents: 4.35 three times is exactly 13.05',
  sumAmounts([{ amount: 4.35 }, { amount: 4.35 }, { amount: 4.35 }]), 13.05);
logic('float version of the same sum is not 13.05',
  [4.35, 4.35, 4.35].reduce((a, b) => a + b, 0) === 13.05, false);
logic('cents: a hundred 0.07s sum to exactly 7',
  sumAmounts(Array.from({ length: 100 }, () => ({ amount: 0.07 }))), 7);

logic('toCents: 4.565 does not lose a cent', toCents(4.565), 457);
logic('toCents: plain values', [toCents(4.5), toCents(0.07), toCents(1234.5)], [450, 7, 123450]);
logic('toCents: non-numeric is zero, not NaN', toCents('abc'), 0);
logic('fromCents: round trip', fromCents(toCents(19.99)), 19.99);

// Stored rows are still decimals — nothing migrated, old data sums the same.
logic('storage shape unchanged: amounts stay decimal',
  addExpense([], { description: 'x', amount: '4.50', category: 'food' }, acOpts).expenses[0].amount,
  4.5);

// A breakdown must add back up to the total it is a breakdown of.
const centsCases = [
  { id: 'c1', date: '2026-10-01', category: 'food', description: 'a', amount: 0.1 },
  { id: 'c2', date: '2026-10-01', category: 'food', description: 'b', amount: 0.2 },
  { id: 'c3', date: '2026-10-02', category: 'shop', description: 'c', amount: 4.35 },
  { id: 'c4', date: '2026-10-02', category: 'shop', description: 'd', amount: 4.35 },
];
logic('stats: total is exact', St.sum(centsCases), 9);
logic('stats: per-category totals are exact',
  St.byCategory(centsCases), { food: 0.3, shop: 8.7 });
logic('stats: the breakdown adds back up to the total',
  Object.values(St.byCategory(centsCases)).reduce((a, b) => a + b, 0) === St.sum(centsCases), true);
logic('stats: per-day totals are exact', St.byDay(centsCases)['2026-10-01'], 0.3);

/* ── Foundation: the assistant must name a category ────────────── */

const noCat = { description: 'Taxi', amount: '12.00' };
logic('assistant: an omitted category is refused',
  addExpense(base, noCat, { ...acOpts, source: 'assistant' }).error.code, ERR.CATEGORY_REQUIRED);
logic('assistant: the refusal lists what it could have chosen',
  addExpense(base, noCat, { ...acOpts, source: 'assistant' }).error.known, ['food', 'shop']);
logic('assistant: an unknown category is refused too',
  addExpense(base, { ...noCat, category: 'taxi' }, { ...acOpts, source: 'assistant' }).error.code,
  ERR.CATEGORY_UNKNOWN);
logic('assistant: naming a real category works',
  addExpense(base, { ...noCat, category: 'shop' }, { ...acOpts, source: 'assistant', id: 'z1' }).ok, true);
logic('assistant: and files it where it said',
  addExpense(base, { ...noCat, category: 'shop' }, { ...acOpts, source: 'assistant', id: 'z1' })
    .expenses.at(-1).category, 'shop');

// A reviewed decision can still go through without a category, because at that
// point a person has seen it — that is the "visible review decision" path.
logic('assistant: an explicit opt-out still allows the fallback',
  addExpense(base, noCat, { ...acOpts, source: 'assistant', requireCategory: false }).ok, true);

// The form is unaffected: its select always has a value, and omitting one
// still falls back, exactly as before.
logic('manual: an omitted category still falls back to the first',
  addExpense(base, noCat, acOpts).expenses.at(-1).category, 'food');
logic('manual: an unknown category is still refused',
  addExpense(base, { ...noCat, category: 'nope' }, acOpts).error.code, ERR.CATEGORY_UNKNOWN);

/* ── Assistant: typed intents ──────────────────────────────────── */

const AI_CATS = [
  { id: 'food', label: 'Food' },
  { id: 'hire', label: 'Private hire' },
];
const AI_TODAY = '2026-10-15';
const AI_ROWS = [
  { id: 'r1', date: '2026-10-14', category: 'food', description: 'Chicken rice', amount: 4.5, notes: '' },
  { id: 'r2', date: '2026-10-15', category: 'food', description: 'Kopi', amount: 1.4, notes: '' },
  { id: 'r3', date: '2026-10-15', category: 'hire', description: 'Grab home', amount: 14.8, notes: '' },
  { id: 'r4', date: '2026-09-02', category: 'food', description: 'Laksa', amount: 7.2, notes: '' },
];
const vi = (raw) => validateIntent(raw, { cats: AI_CATS });
const plan = (intent, over = {}) =>
  planFromIntent(intent, { expenses: AI_ROWS, cats: AI_CATS, today: AI_TODAY, actionLog: [], ...over });

/* The model is never trusted: a figure it supplies is dropped, not used. */
const sneaky = vi({ type: 'answer', query: { metric: 'total', period: 'month' }, total: 9999, say: 'Here' });
logic('intent: a figure invented by the model is stripped', 'total' in sneaky.intent, false);
logic('intent: unknown type refused', vi({ type: 'transfer_money' }).error.code, INTENT_ERR.UNKNOWN_TYPE);
logic('intent: a non-object refused', vi('delete everything').error.code, INTENT_ERR.NOT_OBJECT);
logic('context: the expense rows are never sent',
  Object.keys(buildContext({ cats: AI_CATS, today: AI_TODAY, expenses: AI_ROWS })).includes('expenses'),
  false);
logic('context: only vocabulary and the date go out',
  Object.keys(buildContext({ cats: AI_CATS, today: AI_TODAY, expenses: AI_ROWS })).sort(),
  ['categories', 'expenseCount', 'hasData', 'today']);

/* ── 1. answer ── */
const ansOk = vi({ type: 'answer', query: { metric: 'total', period: 'month', category: null } });
logic('answer/ok: validates', ansOk.ok, true);
const ansPlan = plan(ansOk.intent);
// 4.50 + 1.40 + 14.80 = 20.70, computed here from the rows, not by the model.
logic('answer/ok: the figure is computed from the rows', ansPlan.text, 'You spent S$20.70 this month.');
logic('answer/ok: it matches a direct sum', ansPlan.text.includes(money(St.sum(St.inRange(AI_ROWS, '2026-10-01', AI_TODAY)))), true);
logic('answer/ok: scoped by category',
  plan(vi({ type: 'answer', query: { metric: 'total', period: 'month', category: 'hire' } }).intent).text,
  'You spent S$14.80 private hire this month.');
logic('answer/ok: a period with no rows says so',
  plan(vi({ type: 'answer', query: { metric: 'total', period: 'yesterday', category: 'hire' } }).intent).text,
  "I don't have any expenses recorded for private hire yesterday yet.");

// Ambiguous: the model names a metric or category that does not exist.
logic('answer/ambiguous: unknown metric refused',
  vi({ type: 'answer', query: { metric: 'vibes', period: 'month' } }).error.code, INTENT_ERR.UNKNOWN_METRIC);
logic('answer/ambiguous: hallucinated category refused',
  vi({ type: 'answer', query: { metric: 'total', period: 'month', category: 'groceries' } }).error.code,
  INTENT_ERR.UNKNOWN_CATEGORY);
logic('answer/ambiguous: the refusal lists the real categories',
  vi({ type: 'answer', query: { metric: 'total', period: 'month', category: 'groceries' } }).error.known,
  ['food', 'hire']);

/* ── 2. propose_add ── */
const addOk = vi({ type: 'propose_add', expense: { description: 'Nasi lemak', amount: '5.80', category: 'food' } });
const addPlan = plan(addOk.intent);
logic('add/ok: becomes a confirmation, not a change', addPlan.kind, 'confirm_add');
logic('add/ok: it is explicit about needing confirmation', addPlan.needsConfirmation, true);
logic('add/ok: the exact figures are shown first',
  addPlan.summary, 'Nasi lemak · S$5.80 · Food · 15 Oct');
logic('add/ok: planning does not touch the list', AI_ROWS.length, 4);
// A repeat is surfaced on the card rather than silently filed.
const addDup = plan(vi({ type: 'propose_add', expense: { description: 'Kopi', amount: '1.40', category: 'food', date: '2026-10-15' } }).intent);
logic('add/ok: an existing match is flagged on the card', addDup.duplicate?.id, 'r2');

// Ambiguous: no category named. The model must not pick one.
const addNoCat = vi({ type: 'propose_add', expense: { description: 'Taxi', amount: '12.00' } });
logic('add/ambiguous: validates as an intent', addNoCat.ok, true);
logic('add/ambiguous: but the plan refuses to guess a category', plan(addNoCat.intent).kind, 'clarify');
logic('add/ambiguous: and asks, naming the real options',
  plan(addNoCat.intent).question, 'Which category should that go in? Food, Private hire');
logic('add/ambiguous: a missing amount asks rather than inventing one',
  plan(vi({ type: 'propose_add', expense: { description: 'Lunch', category: 'food' } }).intent).question,
  'How much was it?');
logic('add/ambiguous: an unreadable amount is not stored',
  plan(vi({ type: 'propose_add', expense: { description: 'Lunch', amount: 'a few dollars', category: 'food' } }).intent).kind,
  'clarify');

/* ── 3. find_delete_candidates ── */
const delOk = vi({ type: 'find_delete_candidates', filter: { description: 'grab' } });
const delPlan = plan(delOk.intent);
logic('delete/ok: one match still needs confirmation', delPlan.kind, 'confirm_delete');
logic('delete/ok: never deletes on its own', delPlan.needsConfirmation, true);
logic('delete/ok: resolves to a real id from the real rows', delPlan.candidates[0].id, 'r3');
logic('delete/ok: shows what would go', delPlan.candidates[0].summary, 'Grab home · S$14.80 · Private hire · 15 Oct');
logic('delete/ok: planning does not remove anything', AI_ROWS.length, 4);

// Ambiguous: a filter matching several rows offers a choice instead of picking.
const delMany = plan(vi({ type: 'find_delete_candidates', filter: { category: 'food' } }).intent);
logic('delete/ambiguous: all matches are offered', delMany.candidates.length, 3);
logic('delete/ambiguous: it asks which one', delMany.text, 'I found 3 that match. Which one?');
logic('delete/ambiguous: an empty filter is refused outright',
  vi({ type: 'find_delete_candidates', filter: {} }).error.code, INTENT_ERR.MISSING_FIELD);
logic('delete/ambiguous: no match deletes nothing and says so',
  plan(vi({ type: 'find_delete_candidates', filter: { description: 'yacht' } }).intent).kind, 'answer');
// An id the model made up is not a deletion path at all — ids are resolved here.
logic('delete: a model-supplied id is not part of the schema',
  'id' in vi({ type: 'find_delete_candidates', filter: { description: 'grab' } }).intent.filter, false);

/* ── 4. undo ── */
const botAction = { type: 'add', source: 'assistant', id: 'bot7', expense: AI_ROWS[1] };
logic('undo/ok: offered when the assistant has changed something',
  plan(vi({ type: 'undo' }).intent, { actionLog: [botAction] }).kind, 'undo');
logic('undo/ambiguous: nothing of its own to undo',
  plan(vi({ type: 'undo' }).intent, { actionLog: [] }).kind, 'answer');
logic('undo/ambiguous: says so plainly',
  plan(vi({ type: 'undo' }).intent, { actionLog: [{ type: 'add', source: 'manual', id: 'x' }] }).text,
  "I haven't changed anything yet, so there's nothing to undo.");
logic('undo: a wider scope is refused', vi({ type: 'undo', scope: 'everything' }).error.code, INTENT_ERR.BAD_FIELD);

/* ── 5. clarify ── */
const clarOk = vi({ type: 'clarify', question: 'Which category?', options: ['Food', 'Private hire'] });
logic('clarify/ok: validates', clarOk.ok, true);
logic('clarify/ok: reaches the user as a question', plan(clarOk.intent).kind, 'clarify');
logic('clarify/ok: options are carried through', plan(clarOk.intent).options, ['Food', 'Private hire']);
logic('clarify/ambiguous: a clarify with no question is refused',
  vi({ type: 'clarify', options: ['a'] }).error.code, INTENT_ERR.MISSING_FIELD);
logic('clarify: option lists are capped',
  vi({ type: 'clarify', question: 'q', options: Array.from({ length: 20 }, (_, i) => `o${i}`) }).intent.options.length, 6);

/* ── The fallback stays usable when the model does not ─────────── */

const failingFetch = async () => { throw new Error('ECONNREFUSED'); };
logic('fallback: an unreachable backend is reported, not thrown',
  (await requestIntentFromBackend('how much this month', { cats: AI_CATS, today: AI_TODAY, expenses: AI_ROWS, fetchImpl: failingFetch })).reason,
  'unreachable');
const notConfigured = async () => ({ ok: false, status: 503, json: async () => ({ error: 'provider_not_configured' }) });
logic('fallback: an unconfigured provider is reported',
  (await requestIntentFromBackend('x', { cats: AI_CATS, fetchImpl: notConfigured })).reason,
  'provider_not_configured');
for (const [code, wording] of [
  ['provider_key_rejected', 'key was rejected'],
  ['provider_access_denied', 'access was denied'],
]) {
  const denied = async () => ({ ok: false, status: 503, json: async () => ({ error: code }) });
  const result = await requestIntentFromBackend('how much this month', { cats: AI_CATS, fetchImpl: denied });
  logic(`fallback: ${code} is a failed model request`, result.ok, false);
  logic(`fallback: ${code} retains its safe code`, result.reason, code);
  logic(`fallback: ${code} explains the cause`, explainIntentFailure(result.reason).includes(wording), true);
  logic(`fallback: ${code} still identifies the offline answer`, explainIntentFailure(result.reason).includes('Answered offline'), true);
  logic(`receipt: ${code} retains its safe code`,
    (await requestReceiptFromBackend({ base64: 'x' }, { fetchImpl: denied })).reason, code);
  logic(`receipt: ${code} explains the cause and retained form`,
    explainFailure(code).includes(wording) && explainFailure(code).includes('form is unchanged'), true);
}
const liar = async () => ({ ok: true, status: 200, json: async () => ({ intent: { type: 'answer', query: { metric: 'vibes' } } }) });
logic('fallback: a malformed intent from the backend is rejected client-side',
  (await requestIntentFromBackend('x', { cats: AI_CATS, fetchImpl: liar })).reason,
  INTENT_ERR.UNKNOWN_METRIC);
const good = async () => ({ ok: true, status: 200, json: async () => ({ intent: { type: 'answer', query: { metric: 'total', period: 'month' } } }) });
logic('fallback: a valid intent comes through',
  (await requestIntentFromBackend('x', { cats: AI_CATS, fetchImpl: good })).intent.query.metric, 'total');
// And the offline matcher still answers on its own, with the same arithmetic.
logic('fallback: lib/ask.js still answers without any backend',
  answer('how much did I spend this month', { expenses: AI_ROWS, cats: AI_CATS, today: AI_TODAY }).text.includes('S$20.70'),
  true);


/* ── Regression: a question must never be silently narrowed ─────
 *
 * Found in a live request. With only Food defined, "how much did I spend on
 * groceries and entertainment this month" came back as category: food. The
 * figure would have been correct and the sentence would have read correctly,
 * and it would have answered a question nobody asked.
 */

const ONE_CAT = [{ id: 'food', label: 'Food' }];
const vi1 = (raw) => validateIntent(raw, { cats: ONE_CAT });
const plan1 = (intent) => planFromIntent(intent, { expenses: AI_ROWS, cats: ONE_CAT, today: AI_TODAY });
const askFor = (terms, category = null, cats = ONE_CAT) =>
  validateIntent({ type: 'answer', query: { metric: 'total', period: 'month', category, category_terms: terms } }, { cats });

// The exact live failure.
const narrowed = askFor(['groceries', 'entertainment'], 'food');
logic('narrowing: the intent still validates', narrowed.ok, true);
logic('narrowing: both terms survive validation', narrowed.intent.query.categoryTerms, ['groceries', 'entertainment']);
logic('narrowing: two categories are not answered, they are queried', plan1(narrowed.intent).kind, 'clarify');
logic('narrowing: the question names what it saw',
  plan1(narrowed.intent).question.includes('groceries, entertainment'), true);
logic('narrowing: and offers the real categories', plan1(narrowed.intent).options, ['Food']);

// Even when the mapping is dropped, two terms is still two questions.
logic('narrowing: two terms with no mapping also clarifies',
  plan1(askFor(['groceries', 'entertainment'], null).intent).kind, 'clarify');

// One term that maps to nothing: answering across all categories would be a
// different question, and answering with the only category a narrower one.
const unmapped = askFor(['entertainment'], null);
logic('narrowing: an unmappable term clarifies', plan1(unmapped.intent).kind, 'clarify');
logic('narrowing: it quotes the term back', plan1(unmapped.intent).question.includes('"entertainment"'), true);

// The legitimate paths must stay open.
logic('narrowing: one term that maps is answered normally',
  plan1(askFor(['food'], 'food').intent).kind, 'answer');
logic('narrowing: no category mentioned is answered across everything',
  plan1(askFor([], null).intent).kind, 'answer');
logic('narrowing: and that answer is the real figure',
  plan1(askFor([], null).intent).text, 'You spent S$20.70 this month.');
// Two real categories named with two real categories defined: still one at a time.
logic('narrowing: two terms clarify even when both exist',
  planFromIntent(askFor(['food', 'private hire'], 'food', AI_CATS).intent,
    { expenses: AI_ROWS, cats: AI_CATS, today: AI_TODAY }).kind,
  'clarify');
// This validator runs on the server AND again on the client, over its own
// output. If it is not idempotent the guard quietly stops working.
const firstPass = askFor(['groceries', 'entertainment'], null);
const secondPass = validateIntent({ type: 'answer', query: firstPass.intent.query }, { cats: ONE_CAT });
logic('narrowing: validating twice keeps the terms',
  secondPass.intent.query.categoryTerms, ['groceries', 'entertainment']);
logic('narrowing: and still clarifies after the second pass',
  plan1(secondPass.intent).kind, 'clarify');

/* Every answer states how it was read. The terms check is a mitigation — the
   model could omit a term and this would see nothing wrong — so the
   interpretation is put in front of the reader rather than assumed correct. */
logic('interpretation: a category answer says which category',
  plan1(askFor(['food'], 'food').intent).interpretation,
  { category: 'Food', period: 'this month' });
logic('interpretation: an all-category answer says so',
  plan1(askFor([], null).intent).interpretation,
  { category: 'All categories', period: 'this month' });
logic('interpretation: the period is carried too',
  planFromIntent(validateIntent({ type: 'answer', query: { metric: 'total', period: 'lastweek', category: null, category_terms: [] } }, { cats: ONE_CAT }).intent,
    { expenses: AI_ROWS, cats: ONE_CAT, today: AI_TODAY }).interpretation.period,
  'last week');
logic('interpretation: present even when there is nothing to report',
  planFromIntent(validateIntent({ type: 'answer', query: { metric: 'total', period: 'yesterday', category: 'food', category_terms: ['food'] } }, { cats: ONE_CAT }).intent,
    { expenses: [], cats: ONE_CAT, today: AI_TODAY }).interpretation,
  { category: 'Food', period: 'yesterday' });

// Older intents without the field must not start clarifying.
logic('narrowing: a missing category_terms field is not treated as trouble',
  plan1(vi1({ type: 'answer', query: { metric: 'total', period: 'month', category: 'food' } }).intent).kind,
  'answer');

/* ── Regression: the "highest" answers must report a real figure ──
 *
 * stats.js peak() returns { key, total }. All four top_* branches read
 * peak.value, which is undefined — and money(undefined) is "S$0.00", not a
 * crash. So the assistant said "7 Oct was the most, at S$0.00." Confidently,
 * silently, and wrong: exactly the failure docs/PRD.md §8 exists to prevent.
 *
 * These fix the figure to the source rows, so a shape change in stats.js
 * cannot quietly blank them again.
 */

const PK_CATS = [{ id: 'food', label: 'Food' }, { id: 'hire', label: 'Private hire' }];
const PK_TODAY = '2026-10-20';
// Deliberate structure: 7 Oct is the biggest day (24.50) and sits in the week
// of 5 Oct; October is the biggest month; hire is the biggest category.
const PK_ROWS = [
  { id: 'p1', date: '2026-09-28', category: 'food', description: 'Sep laksa',  amount: 7.2,  notes: '' },
  { id: 'p2', date: '2026-10-05', category: 'food', description: 'Lunch',      amount: 4.5,  notes: '' },
  { id: 'p3', date: '2026-10-07', category: 'hire', description: 'Grab',       amount: 18.2, notes: '' },
  { id: 'p4', date: '2026-10-07', category: 'food', description: 'Dinner',     amount: 6.3,  notes: '' },
  { id: 'p5', date: '2026-10-14', category: 'hire', description: 'Grab again', amount: 12.0, notes: '' },
];
const pkPlan = (metric, period = 'all') => planFromIntent(
  validateIntent({ type: 'answer', query: { metric, period, category: null, category_terms: [] } }, { cats: PK_CATS }).intent,
  { expenses: PK_ROWS, cats: PK_CATS, today: PK_TODAY });

/* The shape peak() actually returns — assert it, since the bug was a caller
   reading a field that never existed. */
logic('peak: returns key and total', Object.keys(St.topDay(PK_ROWS)).sort(), ['key', 'total']);
logic('peak: has no "value" field to read', 'value' in St.topDay(PK_ROWS), false);

/* ── Highest day: 7 Oct = 18.20 + 6.30 = 24.50 ── */
const biggestDay = (1820 + 630) / 100;
logic('top_day: the source rows total 24.50', biggestDay, 24.5);
logic('top_day: stats agrees', St.topDay(PK_ROWS).total, biggestDay);
logic('top_day: the answer names the right day',
  pkPlan('top_day').text.includes(dayLabel('2026-10-07')), true);
logic('top_day: and reports the real figure',
  pkPlan('top_day').text, `${dayLabel('2026-10-07')} was the most, at S$24.50.`);
logic('top_day: never reports a blank amount', pkPlan('top_day').text.includes('S$0.00'), false);

/* ── Highest week: the week of 5 Oct holds 4.50 + 18.20 + 6.30 = 29.00 ── */
const biggestWeek = (450 + 1820 + 630) / 100;
logic('top_week: the source rows total 29.00', biggestWeek, 29);
logic('top_week: stats agrees', St.topWeek(PK_ROWS).total, biggestWeek);
logic('top_week: the answer reports the real figure',
  pkPlan('top_week').text, `The week of ${dayLabel('2026-10-05')} was the most, at S$29.00.`);
logic('top_week: never reports a blank amount', pkPlan('top_week').text.includes('S$0.00'), false);

/* ── Highest month: October = 4.50 + 18.20 + 6.30 + 12.00 = 41.00 ── */
const biggestMonth = (450 + 1820 + 630 + 1200) / 100;
logic('top_month: the source rows total 41.00', biggestMonth, 41);
logic('top_month: stats agrees', St.topMonth(PK_ROWS).total, biggestMonth);
logic('top_month: the answer reports the real figure',
  pkPlan('top_month').text, 'October 2026 was the most, at S$41.00.');
logic('top_month: never reports a blank amount', pkPlan('top_month').text.includes('S$0.00'), false);

/* ── Highest category: hire = 18.20 + 12.00 = 30.20, beating food at 18.00 ── */
const biggestCat = (1820 + 1200) / 100;
logic('top_category: the source rows total 30.20', biggestCat, 30.2);
logic('top_category: stats agrees', St.topCategory(PK_ROWS).total, biggestCat);
logic('top_category: it is hire, not food', St.topCategory(PK_ROWS).key, 'hire');
logic('top_category: the answer uses the label, not the id',
  pkPlan('top_category').text, 'Private hire is the most, at S$30.20 all time.');
logic('top_category: never reports a blank amount', pkPlan('top_category').text.includes('S$0.00'), false);

/* Every displayed figure must equal a direct sum of the rows behind it. */
const sumOf = (pred) => St.sum(PK_ROWS.filter(pred));
logic('top_day: the figure equals a direct sum of that day',
  pkPlan('top_day').text.includes(money(sumOf((e) => e.date === '2026-10-07'))), true);
logic('top_category: the figure equals a direct sum of that category',
  pkPlan('top_category').text.includes(money(sumOf((e) => e.category === 'hire'))), true);
logic('top_month: the figure equals a direct sum of that month',
  pkPlan('top_month').text.includes(money(sumOf((e) => e.date.startsWith('2026-10')))), true);

/* Scoped by period, the peak must move with the window. */
logic('top_day: honours the period window',
  planFromIntent(
    validateIntent({ type: 'answer', query: { metric: 'top_day', period: 'lastmonth', category: null, category_terms: [] } }, { cats: PK_CATS }).intent,
    { expenses: PK_ROWS, cats: PK_CATS, today: PK_TODAY }).text,
  `${dayLabel('2026-09-28')} was the most, at S$7.20.`);

/* Empty data must still not invent a figure. */
logic('top_day: nothing recorded says so, with no amount',
  planFromIntent(
    validateIntent({ type: 'answer', query: { metric: 'top_day', period: 'all', category: null, category_terms: [] } }, { cats: PK_CATS }).intent,
    { expenses: [], cats: PK_CATS, today: PK_TODAY }).text.includes('S$'),
  false);

/* ── Budget status model (§2) ──────────────────────────────────── */

/* ── Last 7 days ───────────────────────────────────────────────── */
{
  const mk = (date, amount) => ({ id: date, date, category: 'food', description: 'x', amount });
  const week = [
    mk('2026-09-28', 10), mk('2026-09-30', 25),   // before the month boundary
    mk('2026-10-01', 5), mk('2026-10-03', 40), mk('2026-10-03', 2),
  ];
  const html = renderToString(<WeekBars expenses={week} anchor="2026-10-03" anchorIsToday />);
  // The window is 2026-09-27..2026-10-03, so the two September rows belong in
  // it. Scoping the chart to the displayed month would silently drop them.
  logic('week: totals the whole window, across the 1st', html.includes('S$82.00'), true);
  logic('week: seven columns', count(html, 'class="week-day"'), 7);
  logic('week: the busiest day is marked', count(html, 'week-bar top'), 1);
  logic('week: days with nothing still get a column', count(html, 'week-bar none'), 3);
  logic('week: the anchor has its actual weekday', html.includes('Sat'), true);
  // A past month ends on its last day, and calling that "Today" would be a lie.
  logic('week: a past window is not labelled Today',
    renderToString(<WeekBars expenses={week} anchor="2026-10-03" />).includes('>Today<'), false);
  logic('week: an empty window says so',
    renderToString(<WeekBars expenses={[]} anchor="2026-10-03" />).includes('Show transactions'), true);
  /* 82 over 7 days. Assert the figure, not a phrase containing it: React SSR
     puts a <!-- --> marker between static text and an expression, so 'avg ' and
     the number are not adjacent in the output. */
  logic('week: the average is the window total over seven',
    renderToString(<WeekBars expenses={week} anchor="2026-10-03" />).includes('S$11.71'), true);
}

logic('status: no budget set', budgetStatus(50, 0).label, 'No budget set');
logic('status: on track below 75%', budgetStatus(100, 200).label, 'On track');
logic('status: 74% is still on track', budgetStatus(74, 100).label, 'On track');
logic('status: 75% is close to limit', budgetStatus(75, 100).label, 'Close to limit');
logic('status: 99% is close to limit', budgetStatus(99, 100).label, 'Close to limit');
// Exactly on budget is its own state — it is not yet over.
logic('status: exactly 100% is budget reached', budgetStatus(100, 100).label, 'Budget reached');
logic('status: above budget is over', budgetStatus(101, 100).label, 'Over budget');
logic('status: keys follow the labels',
  [budgetStatus(10, 100).key, budgetStatus(80, 100).key, budgetStatus(120, 100).key],
  ['calm', 'watch', 'over']);
/* The wallpaper's three states are a projection of those keys, not a second set
   of thresholds. Asserted at every boundary the labels above use, because the
   failure mode is silent: a scene that decays while the chip says "On track". */
logic('decay: no budget is healthy', decayLevel(budgetStatus(50, 0).key), 0);
logic('decay: 74% is healthy', decayLevel(budgetStatus(74, 100).key), 0);
logic('decay: 75% is strained', decayLevel(budgetStatus(75, 100).key), 1);
logic('decay: 99% is strained', decayLevel(budgetStatus(99, 100).key), 1);
logic('decay: exactly 100% is strained, not run down',
  decayLevel(budgetStatus(100, 100).key), 1);
logic('decay: 101% is run down', decayLevel(budgetStatus(101, 100).key), 2);
logic('decay: an unknown key is healthy', decayLevel('nonsense'), 0);

// The chip reports the true figure even past 100 — only the bar clamps.
logic('status: pct is not capped', budgetStatus(108, 100).pct, 108);
logic('status: over amount', budgetStatus(108, 100).over, 8);
logic('status: left goes negative', budgetStatus(108, 100).left, -8);
logic('status: no budget means no percentage', budgetStatus(50, 0).pct, 0);

/* ── Theme list and migration ──────────────────────────────────── */

logic('three scene themes', THEMES.map((t) => t.id), ['forest', 'beach', 'city']);
logic('every theme is a scene', THEMES.every((t) => t.bgKind === 'scene'), true);
logic('every theme carries the §7 tokens',
  THEMES.every((t) => ['--ground', '--card', '--tx', '--on-scene', '--st-calm', '--st-over',
    '--nav-bg', '--scrim-home', '--scrim-page'].every((k) => t.vars[k])), true);
logic('every theme has an empty-state title', THEMES.every((t) => !!t.title), true);
// A saved id can outlive its theme; those three went in the redesign.
logic('removed theme ids are not known',
  ['pink', 'midnight', 'mahjong'].some(isKnownTheme), false);
logic('a removed id falls back to the forest', themeById('mahjong').id, DEFAULT_THEME);
logic('a known id is kept', themeById('city').id, 'city');

/* ── Scene engine (stubbed DOM, no browser) ────────────────────── */

/**
 * Mounts a theme's wallpaper into a fake DOM and hands back everything the
 * engine wrote: the markup, the injected stylesheet, and a stand-in for the
 * scene root so the state setters can be driven the way React drives them.
 */
function mount(theme, wide = false) {
  let html = '';
  let css = '';
  const root = {
    attrs: {},
    classes: new Set(),
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    classList: {
      toggle: (c, on) => { if (on) root.classes.add(c); else root.classes.delete(c); },
    },
  };
  let styleEl = null;

  globalThis.window = { innerWidth: wide ? 1440 : 390, innerHeight: wide ? 900 : 844, matchMedia: () => ({ matches: wide }) };
  globalThis.document = {
    documentElement: { clientWidth: 390, style: { setProperty: () => {} } },
    head: { appendChild: (el) => { styleEl = el; css = el.textContent; } },
    createElement: () => ({ textContent: '' }),
    getElementById: (id) => (id === 'bg'
      ? { set innerHTML(v) { html = v; }, get innerHTML() { return html; } }
      : (id === 'scene-css' ? styleEl : null)),
    querySelector: (sel) => (sel === '#bg .scene' && html.includes('class="scene"') ? root : null),
  };

  paintBackground(typeof theme === 'string' ? THEMES.find((t) => t.id === theme) : theme);
  return { html, css, root };
}


// City has no entry in THEMES, so it is mounted through a bare descriptor —
// the engine only ever reads these two fields.
const CITY = { bgKind: 'scene', scene: 'city', vars: {} };
const forest = mount('forest');
const beach = mount('beach');

/* Composed at a fixed 390x844 and scaled by the viewBox, so nothing in the
   markup may depend on the window size — that is what makes a resize free. */
for (const [name, m] of [['forest', forest], ['beach', beach]]) {
  logic(`${name}: composed in the 390x844 reference box`, m.html.includes('viewBox="0 0 390 844"'), true);
  // Anchored to the TOP, not centred: section 4's zones are measured down from
  // y=0, so centring the overflow would push the focal band under the hero text.
  logic(`${name}: fills the viewport by slicing, not stretching`, m.html.includes('preserveAspectRatio="xMidYMin slice"'), true);
  logic(`${name}: carries the scene class`, m.html.includes('class="scene"'), true);
  logic(`${name}: mounts in the healthy state`, m.html.includes('data-decay="0"'), true);
  logic(`${name}: no viewport size baked into the svg tag`, /<svg[^>]*\swidth="/.test(m.html), false);
  logic(`${name}: no NaN reaches the svg`, m.html.includes('NaN'), false);
}

logic('forest: rebuild is identical (no reshuffle)', mount('forest').html === forest.html, true);

// Sized off the viewport HEIGHT: filling the width cropped everything below
// y 216 on a laptop, which is the deer, the river and the treeline.
logic('scene keeps its drawn aspect ratio', forest.css.includes('aspect-ratio:390/844'), true);
logic('scene is sized by height, not stretched', forest.css.includes('height:100%;width:auto'), true);
logic('scene still covers a phone edge to edge', forest.css.includes('min-width:100%'), true);
// City has no entry in THEMES until phase 2 replaces them, so it is mounted
// through a bare descriptor — the engine only ever reads these two fields.
logic('city builds', mount(CITY).html.includes('class="scene"'), true);
logic('city: no NaN reaches the svg', mount(CITY).html.includes('NaN'), false);
logic('city: composed in the same box', mount(CITY).html.includes('viewBox="0 0 390 844"'), true);

/* ── The widescreen compositions ───────────────────────────────── */

/* A second composition per scene, drawn for a screen that has a rail and two
   columns sitting on top of the art. Only ONE is ever mounted: the phone must
   not pay for the laptop's element count. */
for (const name of ['forest', 'beach', 'city']) {
  const theme = name === 'city' ? CITY : name;
  const w = mount(theme, true);
  logic(`${name}: wide is composed in the 1440x900 box`,
    w.html.includes('viewBox="0 0 1440 900"'), true);
  logic(`${name}: wide mounts healthy`, w.html.includes('data-decay="0"'), true);
  logic(`${name}: wide has no NaN`, w.html.includes('NaN'), false);
  logic(`${name}: only one composition is mounted`,
    (w.html.match(/<svg/g) || []).length, 1);
  logic(`${name}: narrow stays in the phone box`,
    mount(theme, false).html.includes('viewBox="0 0 390 844"'), true);
}

/* The reason two compositions were affordable at all: the decay stylesheet is
   written against CLASS NAMES, never coordinates, so every rule in it already
   applies to the wide art. If a wide scene stopped carrying a class, its decay
   would silently stop working at laptop width only — which is precisely the
   bug nobody would find before the demo. */
for (const [name, theme, classes] of [
  ['forest', 'forest', ['moon-glow', 'moon-0', 'moon-1', 'moon-2', 'river-lines', 'fish-group', 'deer', 'fog', 'bare', 'deadfall', 'leaf-drop', 'ridge-far']],
  ['beach', 'beach', ['s0', 'sun', 'sea-top', 'sand-top', 'beach-stars', 'mouth-happy', 'mouth-flat', 'mouth-sad', 'surf-wrap', 'crab-wrap', 'rocks', 'litter']],
  ['city', CITY, ['win-col', 'win-dark', 'face-happy', 'face-flat', 'face-sad', 'rain-layer', 'rain-heavy', 'street-ref', 'puddle-wide', 'viaduct-lamp', 'skyline-far']],
]) {
  const w = mount(theme, true).html;
  logic(`${name}: wide carries every decay class`,
    classes.filter((c) => !w.includes(`${c}"`) && !w.includes(`${c} `)), []);
}

/* Rule 3.2: spending must never touch the markup. */
logic('scene markup takes no budget argument', paintBackground.length, 1);

/* The setters act on whatever is mounted now, so give them a fresh scene. */
const live = mount('forest');

/* Rule 3.3: one attribute carries the whole state change. */
setSceneDecay(1);
logic('strained sets data-decay', live.root.getAttribute('data-decay'), '1');
setSceneDecay(2);
logic('run down sets data-decay', live.root.getAttribute('data-decay'), '2');
setSceneDecay(0);
logic('recovering clears data-decay', live.root.getAttribute('data-decay'), '0');
logic('switching state leaves the markup untouched', live.html === forest.html, true);

/* A level outside 0..2 would match no rule at all and strand the scene on
   whatever it last showed, which is worse than snapping to a neighbour. */
setSceneDecay(9);
logic('a level above the range clamps', live.root.getAttribute('data-decay'), '2');
setSceneDecay(-4);
logic('a negative level clamps', live.root.getAttribute('data-decay'), '0');
setSceneDecay(undefined);
logic('a missing level falls back to healthy', live.root.getAttribute('data-decay'), '0');

/* Rule 3.6 and 3.9: pausing and stillness are classes, not rebuilds. */
setScenePaused(true);
logic('pausing adds the paused class', live.root.classes.has('paused'), true);
setScenePaused(false);
logic('resuming removes it', live.root.classes.has('paused'), false);
setSceneStill(true);
logic('reduced motion adds the still class', live.root.classes.has('still'), true);
setSceneStill(false);
logic('and removes it', live.root.classes.has('still'), false);

/* The stylesheet is shared, so it must be injected exactly once. */
logic('stylesheet is injected', forest.css.includes('@keyframes w-deer'), true);
// One base rule plus one per decayed level. The moon glow is the canary: if a
// level is ever dropped from the stylesheet this count is what notices.
logic('every healthy value has a counterpart at both levels',
  count(forest.css, '.moon-glow{'), 3);

/* The phase is three pre-masked discs cross-faded, NOT one shade circle moved
   by CSS. Chrome rasterises mask content once, so a cx driven from CSS moves
   the element without rebuilding the mask and the phase never renders — which
   is exactly how it shipped, unnoticed, until the third state made it obvious.
   Assert the structure, since the symptom is invisible to every other test. */
logic('the moon has a disc per state', count(forest.html, 'mask="url(#fmoon'), 3);
logic('no mask geometry is driven from CSS', forest.css.includes('.moon-shade'), false);
logic('state lives on the data attribute, not in custom properties',
  forest.css.includes('--moon-shade'), false);
logic('pausing is wired to the animated set', forest.css.includes('.scene.paused .a{animation-play-state:paused}'), true);
logic('reduced motion is honoured', forest.css.includes('@media (prefers-reduced-motion: reduce)'), true);
// §3.9's in-app switch. Reduce Motion is an accessibility preference, so the
// opt-out is explicit and is never the default.
logic('reduced motion yields only to an explicit opt-in',
  forest.css.includes(':root:not([data-motion="on"]) #bg .scene .a{animation:none !important}'), true);

/* ── Rule 3.7: every loop ends where it starts ─────────────────── */

const css = forest.css;

/* ── Travel loops close off-frame ────────────────────────────────
 *
 * Every keyframe that carries something across the frame reads --out/--in from
 * the element, because the distance depends on the composition. These assert
 * the property rather than the literal: the first version of the widescreen
 * scenes inherited the phone's numbers, so a car "exiting right" stopped at
 * x 1150 in a 1440 box and then jumped back to x 380 in full view. Every check
 * below fails on that bug; the old string-match passed straight through it. */
logic('wave keyframe reads its shift from the element',
  css.includes('to{transform:translateX(var(--wave,-390px))}'), true);

for (const [name, theme, boxW, period] of [['phone', 'beach', 390, 30], ['wide', 'beach', 1440, 40]]) {
  const html = mount(theme, boxW > 390).html;
  const shifts = [...html.matchAll(/--wave:(-?\d+)px/g)].map((m) => Math.abs(+m[1]));
  logic(`${name}: every wave declares a shift`, shifts.length > 0, true);
  // A shift that is not a whole number of crest periods snaps once a cycle.
  logic(`${name}: wave shift is a whole number of periods`,
    shifts.filter((d) => d % period !== 0), []);
  logic(`${name}: wave shift spans the box`, shifts.every((d) => d >= boxW), true);
}

/* The travel geometry lives in one function, so it is tested as one function
   rather than inferred back out of the markup. */
{
  const t = travel(390, 232, 52);          // a phone car
  logic('travel: out clears the right edge', 232 + 52 + t.out > 390, true);
  logic('travel: in clears the left edge', 232 + 52 + t.in < 0, true);
  const w = travel(1440, 820, 99, 60);     // the same car, wide
  logic('travel: wide out clears the wider edge', 820 + 99 + w.out > 1440, true);
  logic('travel: wide in clears the left edge', 820 + 99 + w.in < 0, true);
  logic('travel: an element already off-frame still exits',
    -136 + 217 + travel(390, -136, 217).out > 390, true);
}

/* And the regression itself: the wide compositions must not be carrying the
   phone's distances. Every traveller's throw has to grow with the box. */
for (const [scene, theme] of [['city', CITY], ['beach', 'beach']]) {
  const grab = (html) => [...html.matchAll(/--out:(-?\d+)px;--in:(-?\d+)px/g)]
    .map((m) => Math.abs(+m[1]) + Math.abs(+m[2]));
  const tall = grab(mount(theme, false).html);
  const wide = grab(mount(theme, true).html);
  logic(`${scene}: both compositions declare travellers`,
    tall.length > 0 && tall.length === wide.length, true);
  // The wide box is 3.7x the phone's. Anything that did not grow by at least
  // 2.5x is a distance that was copied across instead of recomputed.
  logic(`${scene}: wide travel scales with the box`,
    tall.filter((d, i) => wide[i] < d * 2.5), []);
}

// River dashes: every dasharray sums to 24, and the offset is -48.
const dashSums = [...forest.html.matchAll(/stroke-dasharray="(\d+) (\d+)"/g)]
  .map(([, a, b]) => Number(a) + Number(b));
logic('river dash periods all 24', dashSums, [24, 24, 24]);
logic('river offset is a whole number of periods', 48 % 24, 0);
logic('river dash count', dashSums.length, 3);

// Things that reset position fade out at both ends instead of jumping.
for (const [name, frames] of [['rain', 'w-rain'], ['fish', 'w-fish'], ['ripple', 'w-ripple']]) {
  const body = css.match(new RegExp(`@keyframes ${frames}\\{([^}]*\\})*`))?.[0] || '';
  logic(`${name}: starts invisible`, /0%[^{]*\{opacity:0/.test(body), true);
  logic(`${name}: ends invisible`, /100%\{opacity:0/.test(body), true);
}

// The walk cycle returns to the start pose, so the 24s loop is seamless.
logic('deer starts and ends in the same pose',
  css.includes('0%,4%{transform:translateX(0) scaleX(1)}') && css.includes('84%,100%{transform:translateX(0) scaleX(1)}'), true);
logic('deer grazes more than once a lap', (css.match(/rotate\(6[0-9]deg\)/g) || []).length >= 3, true);
logic('shooting stars fade out at both ends',
  /@keyframes w-shoot\{\s*0%,87%\{opacity:0/.test(css) && /100%\{opacity:0/.test(css), true);

// Nothing may pulse in unison: each repeated element gets its own delay.
const delays = new Set([...forest.html.matchAll(/animation-delay:(-?[\d.]+)s/g)].map((m) => m[1]));
logic('forest staggers its animation delays', delays.size > 5, true);

/* Over budget stills the water rather than reversing it. */
logic('flow stops when run down', css.includes('.scene[data-decay="2"] .flow'), true);
logic('the deer stops grazing when strained', css.includes('.scene[data-decay="1"] .deerhead'), true);

/* The middle tier is the one that can silently go missing: delete its rules and
   everything still builds, still passes, and spending 90% of the budget just
   looks healthy. Assert each scene actually defines both levels, and that it
   changes something STRUCTURAL at level 1 rather than only shifting colour. */
for (const [scene, marker] of [['forest', 'fog'], ['beach', 'litter'], ['city', 'win-dark']]) {
  logic(`${scene}: defines a strained state`,
    css.includes(`.scene[data-decay="1"] .${marker}`), true);
  logic(`${scene}: defines a run-down state`,
    css.includes(`.scene[data-decay="2"] .${marker}`), true);
  logic(`${scene}: its strained marker is in the markup`,
    mount(scene === 'city' ? CITY : scene).html.includes(marker), true);
}

/* Anything that differs between levels has to be in the .trc transition list,
   or it snaps instead of easing — the one failure in this feature that looks
   fine in every test and wrong only to the eye. */
const lists = [...css.matchAll(/#bg \.trc?\{transition:([^}]+)\}/g)].map((m) => m[1]);
logic('both transition lists exist', lists.length, 2);
const eased = new Set(
  lists.flatMap((l) => l.split(',').map((part) => part.trim().split(/\s/)[0]))
);
const levelled = new Set(
  [...css.matchAll(/\[data-decay="[12]"\][^{]*\{([^}]*)\}/g)]
    .flatMap((m) => [...m[1].matchAll(/([a-z-]+):/g)].map((d) => d[1]))
);
const unEased = [...levelled].filter((prop) => !eased.has(prop) && prop !== 'animation');
logic('every levelled property eases', unEased, []);
logic('the state change eases once', css.includes('transition:transform 3.2s'), true);

// Every theme is a scene now; an unknown id must still paint something rather
// than leaving the app on a bare background.
logic('unknown theme falls back to a scene',
  mount({ scene: 'nope' }).html.includes('class="scene"'), true);

/* ── Voice: utterance parsing ──────────────────────────────────── */

const vCats = [
  { id: 'food', label: 'Food' },
  { id: 'shop', label: 'Shopping' },
  { id: 'pub', label: 'Public transport' },
  { id: 'hire', label: 'Private hire' },
];
const said = (t, now) => parseUtterance(t, vCats, now);

/* A fixed clock, and the expected date written out in full.

   This used to derive the expectation from `new Date()` in UTC while the parser
   resolves "yesterday" on the Asia/Singapore day. Between 00:00 and 08:00 SGT
   the two disagree and the check failed — a red suite caused by the test, not
   by the parser, which is right. 04:00Z is midday in Singapore, where both
   calendars agree, so the literal below is unambiguous. */
const VOICE_NOW = atUtc('2026-10-06T04:00:00Z');

logic('voice: colloquial dollars-cents', said('four fifty for chicken rice').amount, '4.50');
logic('voice: description from colloquial', said('four fifty for chicken rice').description, 'Chicken rice');
logic('voice: explicit decimal', said('spent 23.90 on lunch').amount, '23.90');
logic('voice: dollar sign stripped', said('$8.20 kopi').amount, '8.20');
logic('voice: word number', said('twelve dollars for grab').amount, '12.00');
logic('voice: tens+unit compound is one number', said('twenty five dollars taxi').amount, '25.00');
logic('voice: dollars and cents spoken out', said('four dollars and fifty cents kopi').amount, '4.50');
logic('voice: dollars then cents, no "and"', said('four dollars fifty kopi').amount, '4.50');
logic('voice: unit then tens is cents not a compound', said('one forty kopi').amount, '1.40');

logic('voice: category matched by label', said('spent 20 on shopping').category, 'shop');
logic('voice: category matched by distinctive word', said('15 dollars public transport').category, 'pub');
logic('voice: no category when nothing matches', said('nine dollars sticker').category, undefined);

logic('voice: yesterday resolves to a date',
  said('five dollars kopi yesterday', VOICE_NOW).date, '2026-10-05');
logic('voice: no date word leaves date alone', said('five dollars kopi').date, undefined);

logic('voice: filler words are dropped', said('add an expense for six dollars kopi').description, 'Kopi');
logic('voice: bare numbers never become the description', said('seven dollars').description, undefined);
logic('voice: description only, no amount', said('chicken rice'), { description: 'Chicken rice' });
logic('voice: empty input is safe', said(''), {});
logic('voice: null input is safe', said(null), {});
logic('voice: gibberish yields nothing usable', said('hmm uh').amount, undefined);
logic('voice: amount of zero is rejected', said('zero dollars kopi').amount, undefined);
logic('voice: works with no categories supplied', parseUtterance('four fifty kopi').amount, '4.50');

/* ── Stats engine ──────────────────────────────────────────────── */

const sCats = [
  { id: 'food', label: 'Food' },
  { id: 'hire', label: 'Private hire' },
  { id: 'shop', label: 'Shopping' },
];
const sExp = [
  { date: '2026-09-28', category: 'food', amount: 10 },   // Mon
  { date: '2026-09-28', category: 'hire', amount: 5 },
  { date: '2026-09-29', category: 'food', amount: 30 },   // Tue — biggest day
  { date: '2026-09-21', category: 'food', amount: 4 },    // previous Mon
  { date: '2026-08-15', category: 'shop', amount: 60 },   // August
];
const TODAY = '2026-09-30';

logic('stats: week starts on Monday', St.weekStart('2026-09-28'), '2026-09-28');
logic('stats: Sunday belongs to the week that began Monday', St.weekStart('2026-09-27'), '2026-09-21');
logic('stats: addDays crosses a month boundary', St.addDays('2026-08-31', 1), '2026-09-01');
logic('stats: addDays goes backwards', St.addDays('2026-09-01', -1), '2026-08-31');

// Across ALL data the August S$60 shopping entry is the peak on every axis.
logic('stats: biggest day', St.topDay(sExp), { key: '2026-08-15', total: 60 });
logic('stats: biggest week', St.topWeek(sExp), { key: '2026-08-10', total: 60 });
logic('stats: biggest month', St.topMonth(sExp), { key: '2026-08', total: 60 });
logic('stats: biggest category', St.topCategory(sExp), { key: 'shop', total: 60 });
// Narrowed to September, the peaks move.
const sept = St.inRange(sExp, '2026-09-01', '2026-09-30');
logic('stats: biggest day within September', St.topDay(sept), { key: '2026-09-29', total: 30 });
logic('stats: biggest week within September', St.topWeek(sept), { key: '2026-09-28', total: 45 });
logic('stats: biggest category within September', St.topCategory(sept), { key: 'food', total: 44 });
logic('stats: empty list has no peak', St.topDay([]), null);

logic('stats: inRange is inclusive of both bounds',
  St.sum(St.inRange(sExp, '2026-09-28', '2026-09-29')), 45);
logic('stats: inRange skips rows without a date',
  St.inRange([{ amount: 5 }], '2026-01-01', '2026-12-31').length, 0);

// 2026-08-15 .. 2026-09-29 inclusive is 46 days; 109 total.
logic('stats: average per day spans idle days',
  Number(St.averagePerDay(sExp).toFixed(2)), Number((109 / 46).toFixed(2)));
logic('stats: average per active day ignores idle days',
  Number(St.averagePerDay(sExp, { mode: 'active' }).toFixed(2)), Number((109 / 4).toFixed(2)));
logic('stats: average per month divides by months with data',
  Number(St.averagePerMonth(sExp).toFixed(2)), Number((109 / 2).toFixed(2)));
logic('stats: averages of nothing are zero', St.averagePerDay([]), 0);

logic('stats: this week', St.period('week', TODAY).start, '2026-09-28');
logic('stats: last week', [St.period('lastweek', TODAY).start, St.period('lastweek', TODAY).end], ['2026-09-21', '2026-09-27']);
logic('stats: last month', [St.period('lastmonth', TODAY).start, St.period('lastmonth', TODAY).end], ['2026-08-01', '2026-08-31']);

/* ── Question answering ────────────────────────────────────────── */

const ask = (q) => answer(q, { expenses: sExp, cats: sCats, today: TODAY });

logic('ask: total this week', ask('how much did I spend this week').text.includes('S$45.00'), true);
logic('ask: total this month defaults when no period given', ask('how much have I spent').text.includes('S$49.00'), true);
logic('ask: total last month', ask('how much did I spend last month').text.includes('S$60.00'), true);
logic('ask: total for a category', ask('how much on food this month').text.includes('S$44.00'), true);
logic('ask: biggest day', ask('which day did I spend the most').intent, 'highest');
logic('ask: biggest day names the amount', ask('which day did I spend the most').text.includes('S$60.00'), true);
logic('ask: biggest day can be scoped to a period', ask('which day did I spend the most this month').text.includes('S$30.00'), true);
logic('ask: biggest week', ask('which week did I spend the most').intent, 'highest');
logic('ask: biggest week amount', ask('what week did I spend the most amount').text.includes('S$60.00'), true);
logic('ask: biggest week scoped to this month', ask('which week did I spend the most this month').text.includes('S$45.00'), true);
logic('ask: biggest month', ask('which month did I spend the most').text.includes('2026-08'), true);
logic('ask: average per week', ask('what is my average spending per week').intent, 'average');
logic('ask: average per month', ask('average spending for the month').intent, 'average');
logic('ask: average per day', ask('how much do I spend on average a day').intent, 'average');
logic('ask: top category all time', ask('what do I spend the most on').text.includes('Shopping'), true);
logic('ask: top category this month', ask('what do I spend the most on this month').text.includes('Food'), true);
logic('ask: count', ask('how many entries this month').text.includes('4'), true);
logic('ask: empty question', answer('', { expenses: sExp, cats: sCats }).intent, 'none');
logic('ask: unrecognised question is honest', ask('what is the meaning of life').intent, 'clarify');
logic('ask: no data for a period says so', answer('how much did I spend today', { expenses: sExp, cats: sCats, today: TODAY }).evidence.rows.length, 0);
logic('ask: no expenses at all is safe', answer('which day did I spend the most', { expenses: [], cats: sCats, today: TODAY }).evidence.rows.length, 0);

// The whole point of this design: arithmetic is exact, never approximated.
logic('ask: singular entry is not "1 entries"',
  ask('which day did I spend the most').evidence.rows.length === 1, true);
logic('ask: no stray space before the full stop',
  ask('what do I spend the most on').detail.includes(' .'), false);

logic('ask: reported total matches a direct sum',
  ask('how much did I spend this week').text.includes(
    'S$' + St.sum(St.inRange(sExp, '2026-09-28', '2026-09-30')).toFixed(2)), true);

/* ── Month trend: the laptop dashboard's main graph ─────────────
 *
 * Every figure below is hand-computed from the four rows in TR_ROWS and
 * written out as a literal. money(undefined) renders as "S$0.00" rather than
 * throwing, so a chart that quietly lost a row would still draw a convincing
 * curve — the only defence is asserting the number.
 *
 *   1 Mar  10.00 + 5.00  -> running 15.00
 *   2 Mar  nothing       -> running 15.00
 *   3 Mar  20.00         -> running 35.00
 *   4 Mar  nothing       -> running 35.00
 *   5 Mar  7.50          -> running 42.50
 *   6..31 Mar nothing    -> running 42.50
 */

const TR_ROWS = [
  { id: 't1', date: '2026-03-01', category: 'food', amount: 10.00 },
  { id: 't2', date: '2026-03-01', category: 'pub', amount: 5.00 },
  { id: 't3', date: '2026-03-03', category: 'food', amount: 20.00 },
  { id: 't4', date: '2026-03-05', category: 'shop', amount: 7.50 },
];

const trPast = monthTrend(TR_ROWS, '2026-03', '2026-10-17', 0);

logic('trend: a past month is drawn whole', trPast.points.length, 31);
logic('trend: March has 31 days', trPast.lastDay, 31);
logic('trend: a past month is not the current one', trPast.isCurrent, false);
logic('trend: day 1 is the sum of both rows on it', trPast.points[0].total, 15);
logic('trend: a day with nothing carries the total forward', trPast.points[1].total, 15);
logic('trend: and reports nothing spent on it', trPast.points[1].spent, 0);
logic('trend: day 3 adds its own row', trPast.points[2].total, 35);
logic('trend: day 5 adds the last row', trPast.points[4].total, 42.5);
logic('trend: the line is flat to the end of the month', trPast.points[30].total, 42.5);
logic('trend: the final total equals a direct sum', trPast.total, St.sum(TR_ROWS));
logic('trend: the final total is the hand-computed figure', trPast.total, 42.5);
logic('trend: the running total never goes down',
  trPast.points.every((p, i) => i === 0 || p.total >= trPast.points[i - 1].total), true);
logic('trend: three days carried spending', trPast.daysWithSpend, 3);
logic('trend: each point names its own date', trPast.points[4].date, '2026-03-05');

/* The axis has to contain the curve, and the budget line with it. */
logic('trend: the scale clears the curve with no budget', trPast.scaleMax, 50);
logic('trend: the scale clears the BUDGET when the budget is higher',
  monthTrend(TR_ROWS, '2026-03', '2026-10-17', 100).scaleMax, 100);
logic('trend: a budget under the curve does not shrink the scale',
  monthTrend(TR_ROWS, '2026-03', '2026-10-17', 20).scaleMax, 50);

/* The current month stops at today rather than drawing days that have not
   happened — eleven flat days to the 31st would read as "spent nothing". */
const trNow = monthTrend(TR_ROWS.map((r) => ({ ...r, date: r.date.replace('2026-03', '2026-10') })),
  '2026-10', '2026-10-17', 310);
logic('trend: the current month stops at today', trNow.points.length, 17);
logic('trend: and says so', trNow.isCurrent, true);
logic('trend: the last point is today', trNow.points[16].date, '2026-10-17');
logic('trend: today carries the full running total', trNow.points[16].total, 42.5);

/* Refusing to draw is a feature. One day of data cannot show a trend. */
logic('trend: two spending days is enough', trPast.enough, true);
logic('trend: one spending day is not',
  monthTrend([TR_ROWS[0]], '2026-03', '2026-10-17', 0).enough, false);
logic('trend: no spending at all is not',
  monthTrend([], '2026-03', '2026-10-17', 0).enough, false);
logic('trend: two rows on the SAME day are still one day',
  monthTrend([TR_ROWS[0], TR_ROWS[1]], '2026-03', '2026-10-17', 0).enough, false);
logic('trend: an empty month reports a zero total',
  monthTrend([], '2026-03', '2026-10-17', 0).total, 0);

/* Month lengths come from the calendar, not from a 30-day assumption. */
logic('trend: February 2026 has 28 days', daysInMonth('2026-02'), 28);
logic('trend: a leap February has 29', daysInMonth('2028-02'), 29);
logic('trend: April has 30', daysInMonth('2026-04'), 30);
logic('trend: December has 31', daysInMonth('2026-12'), 31);
logic('trend: a February month is drawn to 28 points',
  monthTrend(TR_ROWS.map((r) => ({ ...r, date: r.date.replace('2026-03', '2026-02') })),
    '2026-02', '2026-10-17', 0).points.length, 28);

/* A readable axis top, and ticks that reach both ends of it. */
logic('niceCeil: rounds 42.50 up to 50', niceCeil(42.5), 50);
logic('niceCeil: rounds 389.60 up to 400', niceCeil(389.6), 400);
logic('niceCeil: leaves a round 100 alone', niceCeil(100), 100);
logic('niceCeil: zero has no scale', niceCeil(0), 0);
logic('niceCeil: a negative has no scale', niceCeil(-5), 0);
logic('niceCeil: never lands under the value it has to contain',
  [1, 7, 12, 42.5, 99, 101, 389.6, 1234].every((v) => niceCeil(v) >= v), true);
logic('axisTicks: starts at zero', axisTicks(50)[0], 0);
logic('axisTicks: ends at the maximum', axisTicks(50)[4], 50);
logic('axisTicks: five labels for four gaps', axisTicks(50).length, 5);
logic('axisTicks: evenly spaced', axisTicks(50), [0, 12.5, 25, 37.5, 50]);

/* The card itself: the figure has to reach the screen, and the empty state
   has to say why it is empty rather than drawing a flat line. */
const trendHtml = renderToString(
  <MonthTrend expenses={TR_ROWS} ym="2026-03" todayYmd="2026-10-17" budget={100} />);
logic('trend card: names the period', trendHtml.includes('March 2026'), true);
logic('trend card: states the running total', trendHtml.includes('S$42.50'), true);
logic('trend card: labels the scale in Singapore dollars', trendHtml.includes('S$0'), true);
logic('trend card: shows the budget as a reference', trendHtml.includes('budget S$100'), true);
logic('trend card: says the figures are a running total',
  trendHtml.includes('Running total in Singapore dollars'), true);
logic('trend card: offers a way to read individual days',
  trendHtml.includes('to read any day'), true);
logic('trend card: draws a line', trendHtml.includes('trend-line'), true);

const trendEmpty = renderToString(
  <MonthTrend expenses={[TR_ROWS[0]]} ym="2026-03" todayYmd="2026-10-17" budget={100} />);
logic('trend card: refuses to draw from one day',
  trendEmpty.includes('Not enough to show a trend yet'), true);
logic('trend card: and says it will not guess',
  trendEmpty.includes('will not guess'), true);
logic('trend card: draws no line when it refuses',
  trendEmpty.includes('trend-line'), false);

/* ── Sample data ────────────────────────────────────────────────
 *
 * Every figure below is hand-summed from the PATTERN table in
 * lib/sampleData.js, not read back out of it. The dataset exists to be shown
 * to a stranger, so a wrong total here is a wrong total in front of a judge.
 *
 * The 40-entry pattern costs S$503.60. Running totals by day of month:
 *   day  3  64.50      day 10  196.50      day 17  324.10
 *   day  5 111.10      day 12  227.50      day 20  383.30
 *   day  8 164.30      day 15  296.70      day 28  503.60
 */

logic('sample: the whole pattern costs the stated total', patternTotalThrough(28), PATTERN_TOTAL);
logic('sample: and that total is 503.60', PATTERN_TOTAL, 503.6);
logic('sample: day 3 running total', patternTotalThrough(3), 64.5);
logic('sample: day 5 running total', patternTotalThrough(5), 111.1);
logic('sample: day 8 running total', patternTotalThrough(8), 164.3);
logic('sample: day 10 running total', patternTotalThrough(10), 196.5);
logic('sample: day 15 running total', patternTotalThrough(15), 296.7);
logic('sample: day 17 running total', patternTotalThrough(17), 324.1);
logic('sample: day 28 running total', patternTotalThrough(28), 503.6);
logic('sample: the running total never goes down',
  Array.from({ length: 28 }, (_, i) => patternTotalThrough(i + 1))
    .every((v, i, a) => i === 0 || v >= a[i - 1]), true);

logic('sample: the budgets add up to the stated total',
  Object.values(SAMPLE_BUDGETS).reduce((a, b) => a + b, 0), SAMPLE_BUDGET_TOTAL);
logic('sample: and that total is 320', SAMPLE_BUDGET_TOTAL, 320);
/* The point of the dataset: a completed month that is over its budget, so the
   wallpaper's run-down state is reachable on any date. */
logic('sample: a full month overspends its budget', PATTERN_TOTAL > SAMPLE_BUDGET_TOTAL, true);
logic('sample: the month crosses the budget on the stated day',
  patternTotalThrough(OVER_BUDGET_FROM_DAY) > SAMPLE_BUDGET_TOTAL
  && patternTotalThrough(OVER_BUDGET_FROM_DAY - 1) <= SAMPLE_BUDGET_TOTAL, true);
logic('sample: every category has a budget',
  DEF_CATS.every((c) => typeof SAMPLE_BUDGETS[c.id] === 'number'), true);

/* Built against a given today, two calendar months, nothing in the future. */
const SD = buildSample('2026-10-17');
logic('sample: spans the previous month and this one', SD.months, ['2026-09', '2026-10']);
logic('sample: the previous month is laid down whole',
  SD.expenses.filter((e) => e.date.startsWith('2026-09')).length, 40);
logic('sample: the previous month costs the full pattern',
  sampleTotal(SD.expenses.filter((e) => e.date.startsWith('2026-09'))), 503.6);
logic('sample: this month stops at today',
  sampleTotal(SD.expenses.filter((e) => e.date.startsWith('2026-10'))), 324.1);
logic('sample: and never dates a row in the future',
  SD.expenses.every((e) => e.date <= '2026-10-17'), true);
logic('sample: the grand total is both months added up',
  sampleTotal(SD.expenses), 827.7);
logic('sample: every row is marked as sample data', SD.expenses.every(isSampleRow), true);
logic('sample: every row names a real category',
  SD.expenses.every((e) => DEF_CATS.some((c) => c.id === e.category)), true);
logic('sample: every row carries a description', SD.expenses.every((e) => !!e.description), true);
logic('sample: row ids are unique', new Set(SD.expenses.map((e) => e.id)).size, SD.expenses.length);

/* Enough to drive both charts: the phone's seven-day bars and the laptop's
   running total, which refuses to draw from fewer than two days. */
logic('sample: there is spending in the last seven days',
  SD.expenses.filter((e) => e.date >= '2026-10-11' && e.date <= '2026-10-17').length > 0, true);
logic('sample: this month has more than two days with spending on them',
  new Set(SD.expenses.filter((e) => e.date.startsWith('2026-10')).map((e) => e.date)).size > 2, true);
logic('sample: and the trend chart will therefore draw',
  monthTrend(SD.expenses.filter((e) => e.date.startsWith('2026-10')), '2026-10', '2026-10-17', 320).enough,
  true);

/* A short month must not grow days it does not have. */
const SD_FEB = buildSample('2026-03-05');
logic('sample: February is not given a 30th', SD_FEB.expenses.every((e) => e.date.slice(8) <= '28'), true);
logic('sample: a month beginning still lays down the whole previous month',
  SD_FEB.expenses.filter((e) => e.date.startsWith('2026-02')).length, 40);
logic('sample: and only the elapsed days of this one',
  sampleTotal(SD_FEB.expenses.filter((e) => e.date.startsWith('2026-03'))), patternTotalThrough(5));

/* ── Loading and removing: removal is the exact inverse ── */

const MINE = [
  { id: 'mine-1', date: '2026-10-02', category: 'food', amount: 3.5, notes: '' },
  { id: 'mine-2', date: '2026-10-09', category: 'pub', amount: 2.2, notes: '' },
];
const MY_BUD = { food: 77, pub: 33 };

const L = planLoad({ expenses: MINE, budgets: MY_BUD, todayYmd: '2026-10-17' });
logic('load: keeps every row the person entered',
  L.expenses.filter((e) => !isSampleRow(e)).map((e) => e.id), ['mine-1', 'mine-2']);
logic('load: adds the sample rows alongside them',
  L.expenses.length, MINE.length + SD.expenses.length);
logic('load: replaces the budgets with the sample ones', L.budgets, SAMPLE_BUDGETS);
logic('load: says it replaced budgets', L.replacedBudgets, true);
logic('load: remembers the budgets it replaced', L.mark.previousBudgets, MY_BUD);
logic('load: records how many rows it added', L.mark.rowCount, SD.expenses.length);
logic('load: over an empty store it reports nothing was replaced',
  planLoad({ expenses: [], budgets: {}, todayYmd: '2026-10-17' }).replacedBudgets, false);
logic('load: loading twice does not stack two copies',
  planLoad({ expenses: L.expenses, budgets: L.budgets, todayYmd: '2026-10-17' }).expenses.length,
  L.expenses.length);

const R = planRemove({ expenses: L.expenses, budgets: L.budgets, mark: L.mark });
logic('remove: takes back exactly what it added', R.removed, SD.expenses.length);
logic('remove: leaves the person\u2019s own rows untouched',
  R.expenses.map((e) => e.id), ['mine-1', 'mine-2']);
logic('remove: puts the previous budgets back', R.budgets, MY_BUD);
logic('remove: says it restored them', R.restoredBudgets, true);
logic('remove: with no mark it leaves budgets alone rather than guessing',
  planRemove({ expenses: L.expenses, budgets: L.budgets, mark: null }).budgets, L.budgets);
logic('remove: and still removes only the sample rows',
  planRemove({ expenses: L.expenses, budgets: L.budgets, mark: null }).expenses.length, MINE.length);
logic('remove: a store with no sample data removes nothing',
  planRemove({ expenses: MINE, budgets: MY_BUD, mark: null }).removed, 0);

const editedBudgets = { ...L.budgets, food: 123, custom: 45 };
delete editedBudgets.pub;
const editedRemoval = planRemove({ expenses: L.expenses, budgets: editedBudgets, mark: L.mark });
logic('remove: preserves a budget edited after loading', editedRemoval.budgets.food, 123);
logic('remove: preserves a newly added budget', editedRemoval.budgets.custom, 45);
logic('remove: preserves a deleted budget', Object.hasOwn(editedRemoval.budgets, 'pub'), false);
logic('remove: still restores unchanged sample budgets', editedRemoval.budgets.hire, MY_BUD.hire);
logic('remove: a persisted mark protects later edits after reload',
  planRemove({ expenses: L.expenses, budgets: editedBudgets, mark: JSON.parse(JSON.stringify(L.mark)) }).budgets,
  editedRemoval.budgets);
logic('remove: legacy marks leave budgets untouched',
  planRemove({ expenses: L.expenses, budgets: editedBudgets, mark: { previousBudgets: MY_BUD } }).budgets,
  editedBudgets);
logic('remove: does not mutate current budgets', editedBudgets.food, 123);

logic('sample: the store knows when sample rows are present', hasSampleRows(L.expenses), true);
logic('sample: and when they are not', hasSampleRows(R.expenses), false);
logic('sample: a row a person typed is never mistaken for sample data',
  isSampleRow({ id: 'e-sample-ish' }), false);

/* ── Receipt scanning ───────────────────────────────────────────
 *
 * The scan produces a DRAFT. Everything here is about what happens when the
 * model is wrong, because that is the normal case for OCR: a misread year, a
 * subtotal instead of a total, a category that was never offered.
 */

const R_CATS = [{ id: 'food', label: 'Food' }, { id: 'hire', label: 'Private hire' }];
const R_TODAY = '2026-10-16';
const vr = (raw) => validateReceipt(raw, { cats: R_CATS, today: R_TODAY });
const full = {
  isReceipt: true, description: 'Toast Box', amount: '14.90',
  currency: 'SGD', date: '2026-10-15', category: 'food',
};

logic('receipt: a clean scan validates', vr(full).ok, true);
logic('receipt: nothing is missing from a clean scan', vr(full).draft.missing, []);
logic('receipt: the amount is normalised to two decimals', vr({ ...full, amount: '14.9' }).draft.amount, '14.90');
logic('receipt: a printed currency symbol is tolerated', vr({ ...full, amount: 'S$14.90' }).draft.amount, '14.90');
logic('receipt: a thousands separator survives', vr({ ...full, amount: '1,240.00' }).draft.amount, '1240.00');
logic('receipt: a number rather than a string is accepted', vr({ ...full, amount: 14.9 }).draft.amount, '14.90');

// The failure that matters most: an unreadable total must never become a zero.
logic('receipt: an unreadable total is null, not zero', vr({ ...full, amount: null }).draft.amount, null);
logic('receipt: an unreadable total is reported', vr({ ...full, amount: null }).draft.missing, ['amount']);
logic('receipt: garbage in the total is null, not NaN', vr({ ...full, amount: 'TOTAL' }).draft.amount, null);
logic('receipt: a negative total is refused', vr({ ...full, amount: '-5.00' }).draft.amount, null);

// A year misread by a digit is the single most common OCR date failure.
logic('receipt: a future date is dropped', vr({ ...full, date: '2027-10-15' }).draft.date, null);
logic('receipt: a dropped date is reported', vr({ ...full, date: '2027-10-15' }).draft.missing, ['date']);
logic('receipt: today is not the future', vr({ ...full, date: R_TODAY }).draft.date, R_TODAY);
logic('receipt: an impossible date is dropped', vr({ ...full, date: '2026-02-31' }).draft.date, null);
logic('receipt: a malformed date is dropped', vr({ ...full, date: '15/10/2026' }).draft.date, null);

// A category outside the list means the model was not choosing from the list.
logic('receipt: an invented category is rejected outright',
  vr({ ...full, category: 'groceries' }).error.code, RECEIPT_ERR.UNKNOWN_CATEGORY);
logic('receipt: no category is merely missing, not an error',
  vr({ ...full, category: null }).draft.missing, ['category']);

logic('receipt: a photo of something else is refused',
  vr({ ...full, isReceipt: false }).error.code, RECEIPT_ERR.NOT_A_RECEIPT);
logic('receipt: a non-object is refused', vr('nope').error.code, RECEIPT_ERR.NOT_OBJECT);
logic('receipt: null is refused', vr(null).error.code, RECEIPT_ERR.NOT_OBJECT);

logic('receipt: a foreign currency is flagged, never converted',
  [vr({ ...full, currency: 'USD' }).draft.foreign, vr({ ...full, currency: 'USD' }).draft.amount],
  [true, '14.90']);
logic('receipt: the home currency is not flagged', vr(full).draft.foreign, false);
logic('receipt: an unreadable currency is not flagged as foreign',
  vr({ ...full, currency: null }).draft.foreign, false);
logic('receipt: a long shop name is capped',
  vr({ ...full, description: 'x'.repeat(200) }).draft.description.length, 80);

/* The merge contract: a field the scan could not read must keep whatever is
   already typed in the form, rather than being blanked. */
logic('receipt: unread fields are omitted from the form patch',
  Object.keys(receiptToFields(vr({ ...full, amount: null, date: null }).draft)).sort(),
  ['category', 'description']);
logic('receipt: a clean scan patches every field',
  Object.keys(receiptToFields(vr(full).draft)).sort(),
  ['amount', 'category', 'date', 'description']);
// Category is the one field a scan clears rather than omits — the form's
// select is never empty, so leaving it alone would show Food as though the
// scan had chosen it. Everything else is still omitted.
logic('receipt: an empty draft clears only the category', receiptToFields({}), { category: '' });

logic('receipt: missing fields are described in words',
  describeMissing(['amount', 'date']), 'the total and the date');
logic('receipt: one missing field has no list punctuation',
  describeMissing(['amount']), 'the total');
logic('receipt: nothing missing says nothing', describeMissing([]), '');

/* Downscaling is pure arithmetic and worth pinning: getting it wrong sends a
   4000px photo and the scan times out. */
logic('receipt: a large photo is scaled to the long edge', fit(4032, 3024), { width: 1280, height: 960 });
logic('receipt: portrait scales on its own long edge', fit(3024, 4032), { width: 960, height: 1280 });
logic('receipt: a small image is never scaled up', fit(600, 800), { width: 600, height: 800 });

const rFail = async () => { throw new Error('ECONNREFUSED'); };
logic('receipt: an unreachable backend is reported, not thrown',
  (await requestReceiptFromBackend({ base64: 'x', mimeType: 'image/jpeg' }, { cats: R_CATS, today: R_TODAY, fetchImpl: rFail })).reason,
  'unreachable');
const rLiar = async () => ({ ok: true, status: 200, json: async () => ({ draft: { ...full, category: 'invented' } }) });
logic('receipt: a bad draft from the backend is rejected client-side',
  (await requestReceiptFromBackend({ base64: 'x' }, { cats: R_CATS, today: R_TODAY, fetchImpl: rLiar })).reason,
  RECEIPT_ERR.UNKNOWN_CATEGORY);
const rGood = async () => ({ ok: true, status: 200, json: async () => ({ draft: full }) });
logic('receipt: a valid draft comes through',
  (await requestReceiptFromBackend({ base64: 'x' }, { cats: R_CATS, today: R_TODAY, fetchImpl: rGood })).draft.amount,
  '14.90');
logic('receipt: no image is reported before any request is made',
  (await requestReceiptFromBackend({}, { cats: R_CATS, fetchImpl: rGood })).reason, 'image_missing');
logic('receipt: a server error carries its reason', (await requestReceiptFromBackend(
  { base64: 'x' },
  { cats: R_CATS, fetchImpl: async () => ({ ok: false, status: 422, json: async () => ({ error: 'receipt_not_a_receipt' }) }) },
)).reason, 'receipt_not_a_receipt');
logic('receipt: every failure reason has human wording',
  ['timeout', 'unreachable', 'provider_not_configured', 'receipt_not_a_receipt', 'image_too_large', 'wat']
    .every((r) => explainFailure(r).length > 10), true);

/* ── Regressions found by driving the real app in a browser ─────
 *
 * Both of these passed every unit test that existed and still failed on
 * screen, which is the argument for this pass having happened at all.
 */

/* 1. Undo after deleting a row you added in the same session.
 *
 * An add and a later delete of the same row both carried that row's expense id
 * as `action.id`. The toast looked its action up by that id, found the ADD
 * first, and tried to reverse it — which fails, because the row is already
 * gone. The button was offered and did nothing. */
const rAdd = addExpense([], { description: 'Teh peng', amount: '1.80', category: 'food', date: TODAY },
  { cats: sCats, today: TODAY });
const rDel = deleteExpenseById(rAdd.expenses, rAdd.action.id, { source: 'manual' });
const rLog = pushAction(pushAction([], rAdd.action), rDel.action);

logic('undo regression: an action id is not the expense id',
  rAdd.action.actionId === rAdd.action.id, false);
logic('undo regression: the two actions are told apart',
  rAdd.action.actionId === rDel.action.actionId, false);
logic('undo regression: both actions still carry the expense id',
  [rAdd.action.id, rDel.action.id], [rAdd.action.id, rAdd.action.id]);
logic('undo regression: looking up by expense id finds the WRONG action',
  rLog.find((a) => a.id === rDel.action.id).type, 'add');
logic('undo regression: looking up by action id finds the right one',
  rLog.find((a) => a.actionId === rDel.action.actionId).type, 'delete');
logic('undo regression: reverting the delete restores the row',
  revert(rDel.expenses, rLog.find((a) => a.actionId === rDel.action.actionId)).expenses.length, 1);
logic('undo regression: reverting the add instead fails, as it did on screen',
  revert(rDel.expenses, rLog.find((a) => a.id === rDel.action.id)).error.code, ERR.ALREADY_REMOVED);

/* 2. The form must not silently file an unchosen category under the first one.
 *
 * validateExpense falls back to cats[0] when a category is omitted. That was
 * safe while the select could never be empty — the receipt scanner can now
 * empty it deliberately, so the form passes requireCategory like the
 * assistant does. */
logic('category regression: an empty category defaults to the first without requireCategory',
  validateExpense({ description: 'x', amount: '1', category: '', date: TODAY }, { cats: sCats, today: TODAY }).value.category,
  sCats[0].id);
logic('category regression: with requireCategory it is refused instead',
  validateExpense({ description: 'x', amount: '1', category: '', date: TODAY }, { cats: sCats, today: TODAY, requireCategory: true }).error.code,
  ERR.CATEGORY_REQUIRED);
logic('category regression: the refusal points at the category field',
  validateExpense({ description: 'x', amount: '1', category: '', date: TODAY }, { cats: sCats, today: TODAY, requireCategory: true }).error.field,
  'category');

/* 3. A foreign total must never be written into an SGD field. */
const foreignDraft = validateReceipt(
  { isReceipt: true, description: 'Blue Bottle', amount: '19.06', currency: 'USD', date: '2026-10-14', category: 'food' },
  { cats: R_CATS, today: R_TODAY },
).draft;
logic('foreign regression: the amount is read and reported',
  [foreignDraft.amount, foreignDraft.currency, foreignDraft.foreign], ['19.06', 'USD', true]);
logic('foreign regression: the form is offered an EMPTY amount, not no amount',
  receiptToFields(foreignDraft).amount, '');
logic('foreign regression: the rest of the receipt still is',
  Object.keys(receiptToFields(foreignDraft)).sort(), ['amount', 'category', 'date', 'description']);
logic('foreign regression: a home-currency total is offered as usual',
  receiptToFields(validateReceipt({ ...full, currency: 'SGD' }, { cats: R_CATS, today: R_TODAY }).draft).amount,
  '14.90');

/* 3b. The MERGED FORM, which is the thing that was actually wrong.
   Omitting the amount is not the same as clearing it: these fields are spread
   over the form the person is already typing into, so an omitted key keeps the
   old value. Someone part-way through an SGD expense who scans a USD receipt
   used to keep their own figure under the new shop's name — asserting on
   receiptToFields alone could never see it. */
const typing = { date: '2026-10-01', category: 'shop', description: 'Lunch at home', amount: '12.30', notes: 'split' };

logic('merged form: a foreign scan CLEARS an amount already typed',
  mergeReceiptIntoForm(typing, foreignDraft).amount, '');
logic('merged form: the foreign scan still replaces the readable fields',
  (({ description, date, category }) => [description, date, category])(mergeReceiptIntoForm(typing, foreignDraft)),
  ['Blue Bottle', '2026-10-14', 'food']);
logic('merged form: notes are the person\'s own and survive any scan',
  mergeReceiptIntoForm(typing, foreignDraft).notes, 'split');
logic('merged form: an SGD scan fills the amount normally',
  mergeReceiptIntoForm(typing, validateReceipt({ ...full, currency: 'SGD' }, { cats: R_CATS, today: R_TODAY }).draft).amount,
  '14.90');
logic('merged form: an SGD scan with an unreadable total keeps what was typed',
  mergeReceiptIntoForm(typing, validateReceipt({ ...full, amount: null }, { cats: R_CATS, today: R_TODAY }).draft).amount,
  '12.30');
logic('merged form: a foreign scan with an unreadable total ALSO clears it',
  mergeReceiptIntoForm(typing, validateReceipt(
    { ...full, currency: 'USD', amount: null }, { cats: R_CATS, today: R_TODAY },
  ).draft).amount, '');

/* 3c. The sentence that quotes the printed total must never say "null". */
logic('printed total: quoted when it was read', printedTotal(foreignDraft), 'USD 19.06');
logic('printed total: null when the total could not be read',
  printedTotal(validateReceipt({ ...full, currency: 'USD', amount: null }, { cats: R_CATS, today: R_TODAY }).draft),
  null);
logic('printed total: null when there is no currency either', printedTotal({ amount: null, currency: null }), null);

/* 4. An unread category is cleared, not left on the form's default. */
logic('category regression: an unread category clears the field',
  receiptToFields(validateReceipt({ ...full, category: null }, { cats: R_CATS, today: R_TODAY }).draft).category,
  '');
logic('category regression: a read category is passed through',
  receiptToFields(validateReceipt(full, { cats: R_CATS, today: R_TODAY }).draft).category, 'food');

// Monthly display and ranking regressions. The donut retains every slice.
const ranked = cats.map((c, i) => ({ id: c.id, name: c.label, color: c.color, value: i + 1 }));
const rankedHome = renderToString(<HomeView {...home} totalSpent={21} totalBudget={100}
  chartData={ranked} cats={cats} budgets={budgets} spending={spending} monthExp={manyExpenses} />);
logic('Home top four uses highest spending, including later category definitions',
  [...rankedHome.matchAll(/class="legend-row"[^>]*>(.*?)<\/button>/g)].map(m =>
    cats.find(c => m[1].includes(c.label))?.id), ['misc', 'needs', 'shop', 'pub']);
logic('Home donut includes all six categories', count(rankedHome, 'class="donut-slice"'), 6);
logic('Home four category heading', rankedHome.includes('Your top 4 criminals'), true);
const fewHome = renderToString(<HomeView {...home} totalSpent={47.6} totalBudget={740}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending} monthExp={expenses} />);
logic('Home does not create filler rows below five transactions', count(fewHome, 'class="txn-row"'), 3);
logic('Home fewer than four uses truthful heading', fewHome.includes('Your top spending categories'), true);
logic('Home category rows are native keyboard buttons', count(rankedHome, 'class="cat-row"'), cats.length);
run('Category header can change month without leaving category', <Header filteredCat={cats[0]}
  ym="2026-09" onOpenPicker={() => {}} onClearFilter={() => {}} />, 'Change month, September 2026');


/* Exact ledger provenance, shared by model interpretation and offline answers. */
const evCats = [{ id: 'food', label: 'Food' }, { id: 'hire', label: 'Private hire' }, { id: 'pub', label: 'Public transport' }];
const evRows = [
  { id: 'a', date: '2026-10-03', description: 'Equal kopi one', category: 'food', amount: 10, notes: '' },
  { id: 'b', date: '2026-10-03', description: 'Equal kopi two', category: 'food', amount: 10, notes: '' },
  { id: 'c', date: '2026-10-04', description: 'Equal fare', category: 'hire', amount: 10, notes: '' },
  { id: 'd', date: '2026-10-10', description: 'Lunch', category: 'food', amount: 5, notes: '' },
  { id: 'e', date: '2026-09-30', description: 'Earlier fare', category: 'hire', amount: 15, notes: '' },
  { id: 'f', date: '2026-10-17', description: 'Train fare', category: 'pub', amount: 5, notes: '' },
];
const evContext = { expenses: evRows, cats: evCats, today: '2026-10-18' };
const evPlan = (metric, category = null, period = 'month') => planFromIntent({ type: 'answer', query: { metric, period, category } }, evContext);
const evIds = (result) => result.evidence?.rows.map(r => r.id);
for (const metric of ['total', 'count', 'average_per_day', 'average_per_week', 'average_per_month']) {
  logic(`evidence: ${metric} uses exact category and period rows`, evIds(evPlan(metric, 'food')), ['a', 'b', 'd']);
}
logic('evidence: equal amounts retain distinct IDs and exclude equal amounts outside category', evIds(evPlan('total', 'food')), ['a', 'b', 'd']);
logic('evidence: winning day contains both winning rows only', evIds(evPlan('top_day')), ['a', 'b']);
logic('evidence: winning day respects category filtering', evIds(evPlan('top_day', 'hire')), ['c']);
logic('evidence: winning week excludes an out-of-period row in that week', evIds(evPlan('top_week')), ['a', 'b', 'c']);
logic('evidence: winning month excludes losing month', evIds(evPlan('top_month', null, 'all')), ['a', 'b', 'c', 'd', 'f']);
logic('evidence: top category follows deterministic tie winner', evIds(evPlan('top_category', null, 'all')), ['a', 'b', 'd']);
const evEmpty = planFromIntent({ type: 'answer', query: { metric: 'total', period: 'today', category: null } }, { ...evContext, today: '2026-10-18' });
logic('evidence: no matches yields no source rows', evIds(evEmpty), []);
const evOriginal = evPlan('total', 'food');
const evChanged = evRows.map(r => r.id === 'a' ? { ...r, amount: 99, description: 'Edited kopi' } : r);
logic('evidence: source edit marks old answer outdated', evidenceIsOutdated(evOriginal.evidence, evChanged, evCats), true);
logic('evidence: source deletion marks old answer outdated', evidenceIsOutdated(evOriginal.evidence, evRows.filter(r => r.id !== 'b'), evCats), true);
logic('evidence: equal-amount row cannot stand in for deleted source', evidenceIsOutdated(evOriginal.evidence, [...evRows.filter(r => r.id !== 'b'), { ...evRows[1], id: 'replacement' }], evCats), true);
logic('evidence: original displayed figure is retained', evOriginal.text.includes('S$25.00'), true);
logic('evidence: historical row values are retained', evOriginal.evidence.rows[0].amount, 10);
logic('evidence: same rows in another order are current', evidenceIsOutdated(evOriginal.evidence, [...evRows].reverse(), evCats), false);
logic('evidence: out-of-scope edit does not invalidate answer', evidenceIsOutdated(evOriginal.evidence, evRows.map(r => r.id === 'e' ? { ...r, amount: 99 } : r), evCats), false);
logic('evidence: changed competing day invalidates old winner', evidenceIsOutdated(evPlan('top_day').evidence, evRows.map(r => r.id === 'd' ? { ...r, amount: 99 } : r), evCats), true);
logic('evidence: matching additions invalidate old answer', evidenceIsOutdated(evOriginal.evidence, [...evRows, { ...evRows[0], id: 'new' }], evCats), true);
logic('evidence: category rename marks historical labels outdated', evidenceIsOutdated(evOriginal.evidence, evRows, evCats.map(c => c.id === 'food' ? { ...c, label: 'Meals' } : c)), true);
const evOldMessages = [{ from: 'bot', ...evOriginal }];
const evMarked = markOutdatedAnswers(evOldMessages, evChanged, evCats);
logic('evidence: original chat object is not mutated', evOldMessages[0].outdated, undefined);
logic('evidence: Undo does not silently remove the stale warning', markOutdatedAnswers(evMarked, evRows, evCats)[0].outdated, true);
logic('evidence: unchanged messages preserve reference', markOutdatedAnswers(evOldMessages, evRows, evCats) === evOldMessages, true);
for (const [question, ids] of [
  ['how much did I spend on Food this month', ['a', 'b', 'd']],
  ['how many Food entries this month', ['a', 'b', 'd']],
  ['average daily Food spending', ['a', 'b', 'd']],
  ['average weekly Food spending', ['a', 'b', 'd']],
  ['average monthly Food spending', ['a', 'b', 'd']],
  ['which day did I spend the most this month', ['a', 'b']],
  ['which week did I spend the most', ['a', 'b', 'c', 'e']],
  ['which month did I spend the most', ['a', 'b', 'c', 'd', 'f']],
  ['what category did I spend the most on', ['a', 'b', 'd', 'c', 'e']],
]) logic(`offline evidence: ${question}`, evIds(answer(question, evContext)), ids);
logic('offline evidence: unsupported question does not invent rows', answer('hello there', evContext).evidence, undefined);
logic('offline evidence: zero count has no invented source rows', evIds(answer('how many entries today', evContext)), []);
logic('offline evidence: average respects the requested month', answer('average Food spending this month', evContext).interpretation.period.includes('2026-10-01 to 2026-10-18'), true);
for (const [field, value] of [['date', '2026-09-01'], ['category', 'pub'], ['description', 'Changed description'], ['notes', 'Changed note']]) {
  logic(`evidence: source ${field} edit invalidates snapshot`, evidenceIsOutdated(evOriginal.evidence, evRows.map(r => r.id === 'a' ? { ...r, [field]: value } : r), evCats), true);
}
const evMutable = evRows.map(r => ({ ...r }));
const evFrozenAnswer = planFromIntent({ type: 'answer', query: { metric: 'total', period: 'month', category: 'food' } }, { ...evContext, expenses: evMutable });
evMutable[0].amount = 500;
logic('evidence: in-place source edits cannot rewrite historical values', evFrozenAnswer.evidence.rows[0].amount, 10);
logic('evidence: in-place source edit is detected', evidenceIsOutdated(evFrozenAnswer.evidence, evMutable, evCats), true);
logic('evidence: new rows outside the original period do not invalidate answer', evidenceIsOutdated(evOriginal.evidence, [...evRows, { ...evRows[0], id: 'outside', date: '2026-09-01' }], evCats), false);
const evHtml = renderToString(<AnswerEvidence evidence={evOriginal.evidence} />);
logic('evidence UI: contains all three source rows', count(evHtml, '<li>'), 3);
logic('evidence UI: contains full date and category', evHtml.includes('2026-10-03') && evHtml.includes('Food'), true);
logic('evidence UI: is read-only', evHtml.includes('<button'), false);
run('evidence UI: historical snapshot is clearly marked', <AnswerEvidence evidence={evOriginal.evidence} outdated />, 'Out of date.', 'Ask again', 'Historical transactions');
logic('evidence UI: zero rows has no expansion', renderToString(<AnswerEvidence evidence={evEmpty.evidence} />).includes('<summary>'), false);
logic('evidence UI: unsupported reply has no expansion', renderToString(<AnswerEvidence />), '');
let evPayload;
await requestIntentFromBackend('how much food this month', { ...evContext, fetchImpl: async (url, options) => {
  evPayload = options.body;
  return { ok: true, json: async () => ({ intent: { type: 'answer', query: { metric: 'total', period: 'month', category: 'food', expenseIds: ['c'] } } }) };
} });
logic('evidence privacy: model request contains no ledger rows or evidence', /Equal kopi|Earlier fare|expenseIds|evidence|"expenses"/.test(evPayload), false);
logic('evidence privacy: model IDs cannot select answer rows', evIds(planFromIntent(validateIntent({ type: 'answer', query: { metric: 'total', period: 'month', category: 'food', expenseIds: ['c'] } }, { cats: evCats }).intent, evContext)), ['a', 'b', 'd']);

// Matching elapsed periods and independently tracked, immutable evidence.
const cmpCats = [{ id: 'custom-meals', label: 'Food & drinks' }, { id: 'travel', label: 'Public transport' }];
const cmpRow = (id, date, amount, category = 'custom-meals') => ({ id, date, amount, category, description: `Fictional ${id}` });
const cmpRows = [cmpRow('a', '2026-03-01', .1), cmpRow('b', '2026-03-18', .2), cmpRow('c', '2026-02-18', .3), cmpRow('later', '2026-02-19', 90), cmpRow('other', '2026-03-18', 50, 'travel')];
const cmpContext = { expenses: cmpRows, cats: cmpCats, today: '2026-03-18' };
const cmpQuery = { metric: 'compare', period: 'month', category: 'custom-meals' };
const cmp = comparisonAnswer(cmpQuery, cmpContext);
logic('comparison: cents sum exactly and equal totals', [cmp.comparison.sides[0].totalCents, cmp.comparison.sides[1].totalCents, cmp.comparison.differenceCents, cmp.comparison.direction, cmp.comparison.percentage], [30, 30, 0, 'the same', 0]);
logic('comparison: custom category label and exact ranges visible', cmp.interpretation, { category: 'Food & drinks', period: '2026-03-01 to 2026-03-18 vs 2026-02-01 to 2026-02-18' });
logic('comparison: evidence selects both sides independently, excluding other category and later dates', cmp.comparison.sides.map(s => s.evidence.rows.map(r => r.id)), [['a', 'b'], ['c']]);
for (const [date, expected, capped] of [
  ['2026-01-01', '2025-12-01', false], ['2026-03-31', '2026-02-28', true],
  ['2024-03-31', '2024-02-29', true], ['2026-05-31', '2026-04-30', true],
  ['2026-02-28', '2026-01-28', false], ['2026-03-12', '2026-02-12', false],
]) {
  const ranges = comparisonRanges('month', date);
  logic(`comparison: month boundary ${date}`, [ranges.earlier.end, ranges.current.end, ranges.capped], [expected, date, capped]);
}
for (const [date, currentStart, earlierStart, earlierEnd] of [
  ['2026-01-01', '2025-12-29', '2025-12-22', '2025-12-25'],
  ['2026-03-02', '2026-03-02', '2026-02-23', '2026-02-23'],
  ['2026-03-08', '2026-03-02', '2026-02-23', '2026-03-01'],
]) {
  const ranges = comparisonRanges('week', date);
  logic(`comparison: matching weekdays ${date}`, [ranges.current.start, ranges.earlier.start, ranges.earlier.end], [currentStart, earlierStart, earlierEnd]);
}
const cmpMore = comparisonAnswer({ ...cmpQuery, category: null }, cmpContext);
logic('comparison: all categories included and direction more', [cmpMore.comparison.differenceCents, cmpMore.comparison.direction], [5000, 'more']);
const cmpLess = comparisonAnswer(cmpQuery, { ...cmpContext, expenses: [...cmpRows, cmpRow('prior', '2026-02-01', .1)] });
logic('comparison: less and percentage use earlier denominator', [cmpLess.comparison.differenceCents, cmpLess.comparison.direction, cmpLess.comparison.percentage], [-10, 'less', 25]);
for (const [name, rows] of [['current only', [cmpRows[0]]], ['earlier only', [cmpRows[2]]], ['neither', []]]) {
  const result = comparisonAnswer(cmpQuery, { ...cmpContext, expenses: rows });
  logic(`comparison: missing ${name} is explicitly limited`, result.detail.includes('not a reliable spending trend'), true);
  if (name !== 'earlier only') logic(`comparison: ${name} zero baseline has no percent`, [result.comparison.percentage, result.detail.includes('Percentage unavailable')], [null, true]);
}
logic('comparison: shorter month limitation visible', comparisonAnswer(cmpQuery, { ...cmpContext, today: '2026-03-31' }).detail.includes('different numbers of days'), true);
for (const side of cmp.comparison.sides) {
  const id = side.evidence.rows[0].id;
  for (const [operation, rows] of [
    ['edit', cmpRows.map(r => r.id === id ? { ...r, amount: 99 } : r)],
    ['delete', cmpRows.filter(r => r.id !== id)],
    ['add', [...cmpRows, cmpRow('new', side.start, 1)]],
  ]) {
    const marked = markOutdatedAnswers([cmp], rows, cmpCats)[0];
    logic(`comparison: ${operation} on ${side.key} marks old answer outdated`, marked.outdated, true);
    logic(`comparison: ${operation} on ${side.key} preserves figures`, marked.comparison.differenceCents, 0);
    logic(`comparison: ${operation} on ${side.key} warning survives undo`, markOutdatedAnswers([marked], cmpRows, cmpCats)[0].outdated, true);
  }
}
logic('comparison: unrelated added category does not stale filtered comparison', !!markOutdatedAnswers([cmp], [...cmpRows, cmpRow('unrelated', '2026-03-01', 9, 'travel')], cmpCats)[0].outdated, false);
const emptyCmp = comparisonAnswer(cmpQuery, { ...cmpContext, expenses: [] });
logic('comparison: new row invalidates initially empty side', markOutdatedAnswers([emptyCmp], [cmpRows[0]], cmpCats)[0].outdated, true);
for (const q of ['Did I spend more this month than last month?', 'How does my Food & drinks spending this month compare with last month?', 'Did I spend more this week than last week?']) {
  logic(`comparison offline: ${q}`, answer(q, cmpContext).intent, 'compare');
}
logic('comparison offline: custom category preserved', answer('How does my Food & drinks spending this month compare with last month?', cmpContext).interpretation.category, 'Food & drinks');
for (const q of ['compare food & drinks and public transport this month with last month', 'compare food & drinks and entertainment this month with last month', 'compare this year with last year']) logic(`comparison offline: never silently narrows ${q}`, answer(q, cmpContext).intent, 'clarify');
const cmpMulti = planFromIntent({ type: 'answer', query: { ...cmpQuery, categoryTerms: ['Food & drinks', 'Public transport'] } }, cmpContext);
logic('comparison model: multi-category question clarifies', cmpMulti.kind, 'clarify');
logic('comparison model: unsupported period rejected', validateIntent({ type: 'answer', query: { ...cmpQuery, period: 'lastmonth' } }, { cats: cmpCats }).ok, false);
const cmpValidated = validateIntent({ type: 'answer', query: { ...cmpQuery, category_terms: ['Food & drinks'], total: 900, expenseIds: ['other'] } }, { cats: cmpCats });
logic('comparison model: fabricated totals and IDs dropped', Object.keys(cmpValidated.intent.query).sort(), ['category', 'categoryTerms', 'metric', 'period']);
const cmpClient = await requestIntentFromBackend('compare fictional spending', { ...cmpContext, fetchImpl: async (url, options) => {
  logic('comparison privacy: ledger not sent', /Fictional|expenseIds|"expenses"|"amount"/.test(options.body), false);
  return { ok: true, json: async () => ({ intent: cmpValidated.intent }) };
} });
logic('comparison client: normalized intent survives second validation', cmpClient.intent.query.categoryTerms, ['Food & drinks']);
logic('comparison planner: validated model intent uses local totals', planFromIntent(cmpClient.intent, cmpContext).comparison.differenceCents, 0);
const cmpHtml = renderToString(<ComparisonEvidence comparison={cmp.comparison} />);
logic('comparison UI: separate evidence controls', count(cmpHtml, '<summary>'), 2);
logic('comparison UI: both ranges and exact amounts', cmpHtml.includes('2026-02-18') && cmpHtml.includes('2026-03-18') && count(cmpHtml, 'S$0.30') >= 2, true);
logic('comparison UI: empty sides have no misleading controls', renderToString(<ComparisonEvidence comparison={emptyCmp.comparison} />).includes('<summary>'), false);
run('comparison UI: outdated warning', <ComparisonEvidence comparison={cmp.comparison} outdated />, 'Out of date.', 'Ask again', 'Historical transactions');

const cmpWeek = comparisonAnswer({ ...cmpQuery, period: 'week' }, { ...cmpContext, today: '2026-03-04', expenses: [
  cmpRow('mon', '2026-03-02', 1.01), cmpRow('wed', '2026-03-04', 2.02), cmpRow('future', '2026-03-05', 90),
  cmpRow('lastMon', '2026-02-23', 1.01), cmpRow('lastWed', '2026-02-25', 1.01), cmpRow('lastFuture', '2026-02-26', 90),
  cmpRow('wrongCat', '2026-03-04', 90, 'travel'),
] });
logic('comparison: partial week totals exact and future weekdays excluded', cmpWeek.comparison.sides.map(side => side.totalCents), [303, 202]);
logic('comparison: partial week evidence on each side uses matching days and category', cmpWeek.comparison.sides.map(side => side.evidence.rows.map(row => row.id)), [['mon', 'wed'], ['lastMon', 'lastWed']]);
const cmpMoved = cmpRows.map(row => row.id === 'a' ? { ...row, date: '2026-01-01' } : row);
logic('comparison: moving a row out of range invalidates historical answer', markOutdatedAnswers([cmp], cmpMoved, cmpCats)[0].outdated, true);
logic('comparison: recategorizing a source invalidates historical answer', markOutdatedAnswers([cmp], cmpRows.map(row => row.id === 'c' ? { ...row, category: 'travel' } : row), cmpCats)[0].outdated, true);
logic('comparison: original evidence and total remain unchanged after ledger mutation', [cmp.comparison.sides[0].evidence.rows[0].date, cmp.comparison.sides[0].totalCents], ['2026-03-01', 30]);
logic('comparison: unknown category cannot broaden to all spending', comparisonAnswer({ ...cmpQuery, category: 'not-a-real-id' }, cmpContext).kind, 'clarify');

// Final UI patch: full-circle geometry and preview after the complete query pipeline.
const singleDonut = renderToString(<Donut data={[{id:'food',value:34,color:'#D85A30'}]} total={34}/>);
logic('donut single category: two outer and two inner arcs, not coincident endpoints', count(singleDonut,' A'),4);
logic('donut single category: evenodd creates a real centre hole',singleDonut.includes('fill-rule="evenodd"'),true);
logic('donut single category: colour and exact total retained',singleDonut.includes('fill="#D85A30"')&&singleDonut.includes('S$34.00'),true);
logic('donut single category: zero-valued siblings do not break full circle',count(renderToString(<Donut data={[{id:'zero',value:0,color:'#000'},{id:'food',value:34,color:'#D85A30'}]}/>),' A'),4);
logic('donut empty: no misleading ring',renderToString(<Donut data={[{value:0}]}/>),'');
const previewRows = Array.from({length:12},(_,i)=>({id:`preview-${i}`,description:i%2?'Kopi':'Rice',amount:i+1,date:`2026-10-${String(i+1).padStart(2,'0')}`,category:'food'}));
const matched = filterAndSort(previewRows,'Kopi','amount',()=>({label:'Food'}));
logic('recent: search and sorting run before limiting',recentPreview(matched,false).rows.map(r=>r.id),['preview-11','preview-9','preview-7','preview-5','preview-3']);
logic('recent: expansion exposes every matching result',recentPreview(matched,true).rows.length,6);
logic('recent: collapsing returns exactly five matches',recentPreview(matched,false).rows.length,5);
logic('recent: source order is not mutated',previewRows[0].id,'preview-0');
logic('recent: five has no redundant expansion control',recentPreview(previewRows.slice(0,5),false).canExpand,false);
logic('recent: fewer than five has no filler',recentPreview(previewRows.slice(0,3),false).rows.length,3);
logic('recent: no search matches has no expansion control',recentPreview([],false),{rows:[],canExpand:false});
const fiveRecent = renderToString(<HomeView {...home} totalSpent={47.6} totalBudget={740} chartData={chartData} cats={cats} budgets={budgets} spending={spending} monthExp={previewRows.slice(0,5)}/>);
logic('recent UI: five or fewer rows has no View all button',fiveRecent.includes('recent-count-cta'),false);
const manyRecent = renderToString(<HomeView {...home} totalSpent={47.6} totalBudget={740} chartData={chartData} cats={cats} budgets={budgets} spending={spending} monthExp={previewRows}/>);
logic('recent UI: both layouts initially render five real rows',count(manyRecent,'class="txn-row"'),5);
logic('recent UI: total count and expansion control are present',manyRecent.includes('12 transactions')&&manyRecent.includes('View all')&&manyRecent.includes('aria-expanded="false"'),true);

const crabWide = mount('beach', true);
const crabTall = mount('beach', false);
const crabGeometry = crabWide.html.match(/class="a crab crab--wide" style="--k:([\d.]+);animation-duration:16s">\s*<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">/);
logic('crab: laptop has independent geometry',!!crabGeometry,true);
if (crabGeometry) {
  const [,patrol,startX,startY,scale] = crabGeometry.map(Number);
  logic('crab: laptop size is 1.8 times its previous scale',Math.round(scale/1.3*100),180);
  logic('crab: patrol is wider than the previous 60-unit range',126*patrol>100,true);
  logic('crab: full claws and stroke stay inside the crop, including scrollbar',startX+126*patrol+13.7*scale<1425,true);
  logic('crab: feet and leg stroke stay above laptop crop bottom',startY+7.7*scale<900,true);
  logic('crab: entire body stays on sand',startY-9.7*scale>804,true);
}
logic('crab: phone keeps its original size and patrol',crabTall.html.includes('class="a crab" style="--k:1"')&&!crabTall.html.includes('class="a crab crab--wide"'),true);
logic('crab: laptop leg rule does not override pause state',crabWide.css.includes('animation:w-scuttle-wide 16s linear infinite !important'),false);

for (const [reason, expected] of [['unreachable','Connection'],['provider_connection_failed','Connection'],['timeout','timed out'],['provider_timeout','timed out'],['provider_error','provider request failed'],['invalid_intent','validation'],['intent_bad_field','validation']]) {
  logic(`chat safe fallback reason ${reason}`,explainIntentFailure(reason).includes(expected),true);
}
await roastChecks(logic);
queryChecks(logic);
await assistantReliabilityChecks(logic);
voiceMoneyChecks(logic);

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  ${c.ok ? '' : '→ ' + c.detail}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);

process.exitCode = failed ? 1 : 0;
