/* Temporary smoke test: render every view to a string and assert key content.
   Catches bad props, typos and crashes without needing a browser. */
import { renderToString } from 'react-dom/server';
import HomeView from '../src/views/HomeView';
import CategoryView from '../src/views/CategoryView';
import HistoryView from '../src/views/HistoryView';
import AddView from '../src/views/AddView';
import SettingsView from '../src/views/SettingsView';
import MonthSheet from '../src/components/MonthSheet';
import SwipeRow from '../src/components/SwipeRow';
import SearchBar from '../src/components/SearchBar';
import Toast from '../src/components/Toast';
import Donut from '../src/components/Donut';
import BottomNav from '../src/components/BottomNav';
import Header from '../src/components/Header';
import { DEF_CATS } from '../src/themes/themes';
import { matchesQuery, sortExpenses, filterAndSort } from '../src/lib/search';
import { paintBackground } from '../src/themes/scenes';
import { THEMES } from '../src/themes/themes';

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
const run = (name, el, ...must) => {
  try {
    const html = renderToString(el);
    const missing = must.filter((m) => !html.includes(m));
    checks.push({ name, ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : `${html.length} chars` });
  } catch (err) {
    checks.push({ name, ok: false, detail: `THREW: ${err.message}` });
  }
};

run('HomeView', <HomeView
  totalSpent={47.6} totalBudget={740} remaining={692.4} budPct={6} isOver={false}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={expenses} onPickCat={() => {}} {...txn} />,
  'S$47.60', 'Chicken rice', 'Spending breakdown', 'donut-slice', 'swipe-wrap', 'swipe-delete');

run('HomeView over budget', <HomeView
  totalSpent={900} totalBudget={740} remaining={-160} budPct={100} isOver
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={[]} onPickCat={() => {}} {...txn} />,
  'over budget', '-S$160.00', 'progress-fill over');

run('HomeView empty', <HomeView
  totalSpent={0} totalBudget={0} remaining={0} budPct={0} isOver={false}
  chartData={[]} cats={cats} budgets={{}} spending={{}}
  monthExp={[]} onPickCat={() => {}} {...txn} />,
  'No expenses yet this month', 'No budget set');

run('CategoryView', <CategoryView
  cat={cats[0]} items={expenses} total={47.6}
  byMonth={[['2026-09', expenses]]} {...txn} />,
  'All-time total', 'September 2026', 'Transactions');

run('CategoryView empty', <CategoryView
  cat={cats[0]} items={[]} total={0} byMonth={[]} {...txn} />,
  'No entries for this category yet');

run('HistoryView', <HistoryView
  histByYear={[['2026', ['2026-09', '2026-08']]]}
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  ym="2026-09" totalBudget={740} hasExpenses onPickMonth={() => {}} />,
  '2026', 'September 2026', '3 transactions');

run('HistoryView empty', <HistoryView
  histByYear={[]} monthTotals={() => ({ spent: 0, count: 0 })}
  ym="2026-09" totalBudget={0} hasExpenses={false} onPickMonth={() => {}} />,
  'No history yet');

run('AddView new', <AddView
  form={{ date: '2026-09-30', category: 'food', description: '', amount: '', notes: '' }}
  setField={() => () => {}} errors={{}} cats={cats} editId={null}
  onSubmit={() => {}} onCancel={() => {}} />,
  'New expense', 'Amount (SGD)', 'Add expense');

run('AddView edit + errors', <AddView
  form={{ date: '2026-09-30', category: 'food', description: '', amount: '', notes: '' }}
  setField={() => () => {}} errors={{ description: true, amount: true }} cats={cats} editId={7}
  onSubmit={() => {}} onCancel={() => {}} />,
  'Edit expense', 'Save changes', 'highlighted fields', 'class="err"');

run('SettingsView', <SettingsView
  themeId="forest" onTheme={() => {}} appName="Expense Tracker" onAppName={() => {}}
  cats={cats} budDraft={budgets} onBudDraft={() => {}} onSaveBudgets={() => {}} saved={false}
  delCatId="food" onAskDelCat={() => {}} onDelCat={() => {}}
  newCat={{ label: '', color: '#D85A30' }} onNewCat={() => {}} onAddCat={() => {}} />,
  'Moonlit Forest', 'Mahjong Fortune', 'Total monthly budget', 'S$740.00',
  'will be deleted', 'Add new category', 'Selected');

run('MonthSheet', <MonthSheet
  histByYear={[['2026', ['2026-09']]]} ym="2026-09"
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  onPick={() => {}} onClose={() => {}} />,
  'Select month', 'entries', 'aria-modal');

run('Donut single slice', <Donut data={[{ id: 'a', value: 10, color: '#f00' }]} total={10} />, 'S$10.00', 'path');
run('Donut many slices', <Donut data={chartData} total={47.6} />, 'donut-slice', 'Total');
run('BottomNav', <BottomNav tab="add" onGo={() => {}} />, 'aria-current="page"', 'Settings');
run('Header month mode', <Header appName="My Money" ym="2026-09" onShiftMonth={() => {}} onOpenPicker={() => {}} />, 'My Money', 'September 2026', 'Previous month');
run('Header filter mode', <Header appName="X" filteredCat={cats[0]} onClearFilter={() => {}} ym="2026-09" onShiftMonth={() => {}} onOpenPicker={() => {}} />, '← All', 'Food');

run('HomeView with search bar', <HomeView
  totalSpent={72.2} totalBudget={740} remaining={667.8} budPct={10} isOver={false}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={manyExpenses} onPickCat={() => {}} {...txn} />,
  'Search transactions', 'sort-btn', 'EZ-Link top up');

run('HomeView no search bar under threshold', <HomeView
  totalSpent={47.6} totalBudget={740} remaining={692.4} budPct={6} isOver={false}
  chartData={chartData} cats={cats} budgets={budgets} spending={spending}
  monthExp={expenses} onPickCat={() => {}} {...txn} />,
  'Chicken rice');

run('CategoryView with search', <CategoryView
  cat={cats[0]} items={manyExpenses} total={72.2}
  byMonth={[['2026-09', manyExpenses]]} {...txn} />,
  'Search transactions', 'All-time total');

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
run('Toast with undo', <Toast message="Entry deleted" actionLabel="Undo" onAction={() => {}} />, 'Undo', 'toast-action');
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

/* ── Wallpaper sizing (stubbed DOM, no browser) ────────────────── */

/** Renders a theme's wallpaper at a given viewport size and returns the SVG. */
function paintAt(themeId, w, h) {
  let html = '';
  globalThis.window = { innerWidth: w, innerHeight: h };
  globalThis.document = {
    documentElement: { clientWidth: w },
    getElementById: () => ({ set innerHTML(v) { html = v; }, get innerHTML() { return html; } }),
    querySelector: () => null,
  };
  paintBackground(THEMES.find((t) => t.id === themeId));
  return html;
}

const count = (hay, needle) => hay.split(needle).length - 1;

const PHONE = [390, 844];      // iPhone 14-ish
const LAPTOP = [1680, 1050];   // MacBook-ish

for (const [name, id] of [['forest', 'forest'], ['beach', 'beach']]) {
  const phone = paintAt(id, ...PHONE);
  const laptop = paintAt(id, ...LAPTOP);

  logic(`${name}: phone svg spans viewport width`, count(phone, 'width="390"') > 0, true);
  logic(`${name}: laptop svg spans viewport width`, count(laptop, 'width="1680"') > 0, true);
  logic(`${name}: laptop style width matches viewport`, laptop.includes('width:1680px'), true);
  logic(`${name}: anchored at left:0, not centred`, laptop.includes('left:0') && !laptop.includes('translateX'), true);
  logic(`${name}: background rect fills width`, laptop.includes(`<rect width="1680"`), true);
  logic(`${name}: no 430px cap remains`, laptop.includes('width="430"'), false);
}

// Density should scale with width, not stretch.
const fPhone = paintAt('forest', ...PHONE);
const fLaptop = paintAt('forest', ...LAPTOP);
logic('forest: phone keeps the original 10 trees', count(fPhone, 'M0,-64'), 10);
logic('forest: laptop adds trees across the width', count(fLaptop, 'M0,-64'), Math.round(1680 / 39));
logic('forest: phone keeps the original 14 stars', count(fPhone, 'fill="#fff"'), 14);
logic('forest: laptop adds stars', count(fLaptop, 'fill="#fff"'), Math.round(1680 / 28));

const bPhone = paintAt('beach', ...PHONE);
const bLaptop = paintAt('beach', ...LAPTOP);
logic('beach: phone keeps the original 2 clouds', count(bPhone, '<ellipse'), 2);
logic('beach: laptop adds clouds', count(bLaptop, '<ellipse'), Math.max(2, Math.round(1680 / 320)));

// Deterministic: repainting the same size must not reshuffle the scene.
logic('forest: repaint is identical (no reshuffle)', paintAt('forest', ...LAPTOP) === fLaptop, true);

// Pattern wallpapers were already full-bleed; make sure they stayed that way.
const pink = paintAt('pink', ...LAPTOP);
logic('pattern: fills 100% width', pink.includes('width:100%'), true);
logic('pattern: tiles bows', count(pink, '<pattern') , 2);

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  ${c.ok ? '' : '→ ' + c.detail}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
