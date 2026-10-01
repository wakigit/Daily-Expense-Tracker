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
import { parseUtterance } from '../src/lib/parseUtterance';
import { answer } from '../src/lib/ask';
import * as St from '../src/lib/stats';
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

/* ── Wallpaper sizing (stubbed DOM, no browser) ────────────────── */

/** Renders a theme's wallpaper at a given viewport size and returns the SVG. */
function paintAt(themeId, w, h, health = 0, reduced = false) {
  let html = '';
  globalThis.window = {
    innerWidth: w,
    innerHeight: h,
    matchMedia: (q) => ({ matches: reduced && q.includes('reduced-motion') }),
  };
  globalThis.document = {
    documentElement: { clientWidth: w },
    getElementById: () => ({ set innerHTML(v) { html = v; }, get innerHTML() { return html; } }),
    querySelector: () => null,
  };
  paintBackground(THEMES.find((t) => t.id === themeId), health);
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

/* ── Budget-reactive wallpaper ─────────────────────────────────── */

const num = (hay, re) => { const m = hay.match(re); return m ? Number(m[1]) : NaN; };
const moonR = (svg) => num(svg, /r="([\d.]+)" fill="url\(#fMoon\)"/);
const moonY = (svg) => num(svg, /cy="([\d.]+)" r="[\d.]+" fill="url\(#fMoon\)"/);
const sunY  = (svg) => num(svg, /cy="([\d.]+)" r="[\d.]+" fill="url\(#bSun\)"/);

const fHealthy = paintAt('forest', ...PHONE, 0);
const fBroke   = paintAt('forest', ...PHONE, 1);

logic('forest: moon shrinks as budget depletes', moonR(fBroke) < moonR(fHealthy), true);
logic('forest: moon sinks as budget depletes', moonY(fBroke) > moonY(fHealthy), true);
// mix() emits lowercase hex, so compare case-insensitively.
const has = (svg, hex) => svg.toLowerCase().includes(hex.toLowerCase());
logic('forest: sky darkens', has(fHealthy, '#0A0F24') && !has(fBroke, '#0A0F24'), true);
logic('forest: moon reddens into a blood moon', /#(b|B)[0-9a-fA-F]{5}/.test(fBroke), true);
logic('forest: healthy budget keeps the original moon size',
  Math.abs(moonR(fHealthy) - Math.min(...PHONE) * 0.062) < 0.01, true);

const bHealthy = paintAt('beach', ...PHONE, 0);
const bBroke   = paintAt('beach', ...PHONE, 1);
logic('beach: sun sinks toward the horizon', sunY(bBroke) > sunY(bHealthy), true);
logic('beach: sky darkens', has(bHealthy, '#3B2A5C') && !has(bBroke, '#3B2A5C'), true);

// Out-of-range health must not produce nonsense geometry or NaN in the SVG.
logic('health clamps above 1', paintAt('forest', ...PHONE, 5) === fBroke, true);
logic('health clamps below 0', paintAt('forest', ...PHONE, -3) === fHealthy, true);
logic('health undefined behaves as 0', paintAt('forest', ...PHONE) === fHealthy, true);
logic('no NaN reaches the forest svg', fBroke.includes('NaN'), false);
logic('no NaN reaches the beach svg', bBroke.includes('NaN'), false);

// Pattern themes recede but must never vanish.
const pHealthy = paintAt('pink', ...PHONE, 0);
const pBroke = paintAt('pink', ...PHONE, 1);
logic('pattern: icons fade but stay visible',
  num(pBroke, /<g opacity="([\d.]+)"/) < 1 && num(pBroke, /<g opacity="([\d.]+)"/) > 0.3, true);
logic('pattern: healthy budget is fully opaque', num(pHealthy, /<g opacity="([\d.]+)"/), 1);

/* ── Living forest ─────────────────────────────────────────────── */

const countOf = (hay, needle) => hay.split(needle).length - 1;

const alive = paintAt('forest', ...PHONE, 0);
const dying = paintAt('forest', ...PHONE, 0.5);
const dead  = paintAt('forest', ...PHONE, 1);

// Deer
logic('forest: deer runs when the budget is healthy', countOf(alive, 'M9.5,7.5 Q5.5,5 6,9.5') , 1);
logic('forest: deer is gone when the budget is blown', countOf(dead, 'M9.5,7.5 Q5.5,5 6,9.5'), 0);
logic('forest: deer has a motion animation', /type="translate" values="-60,/.test(alive), true);

// Leaves
logic('forest: leaves fall when healthy', countOf(alive, '<g opacity="0.8">') > 0, true);
logic('forest: no leaves when the budget is blown', countOf(dead, '<g opacity="0.8">'), 0);
logic('forest: fewer leaves midway than when healthy',
  countOf(dying, '<g opacity="0.8">') < countOf(alive, '<g opacity="0.8">'), true);

// Canopy vs bare branches
const canopyOpacity = (svg) => Number(svg.match(/<g opacity="([\d.]+)"><path d="M0,-64/)?.[1]);
logic('forest: canopy is full when healthy', canopyOpacity(alive), 1);
logic('forest: canopy is gone when blown', canopyOpacity(dead), 0);
logic('forest: bare branches show through when blown', /stroke-width="2.4" fill="none" opacity="1.00"/.test(dead), true);
logic('forest: trunks are always drawn', countOf(dead, 'M-3,40 L-2,-10') > 0, true);

// River
logic('forest: river flows when healthy', /type="translate" values="0,0;64,0"/.test(alive), true);
logic('forest: river stops when the budget is blown', /type="translate" values="0,0;64,0"/.test(dead), false);
logic('forest: ripples still drawn when stopped', countOf(dead, 'stroke-linecap="round"'), 3);

// Moon phase — the shadow disc slides across as the budget depletes.
const shadowX = (svg) => Number(svg.match(/<circle cx="([\d.]+)" cy="[-\d.]+" r="[\d.]+" fill="black"/)?.[1]);
logic('forest: moon shadow clears the disc when full', shadowX(alive) > 0, true);
logic('forest: moon wanes to a crescent as budget depletes', shadowX(dead) < shadowX(alive), true);
logic('forest: phase mask exists', countOf(alive, 'mask="url(#fPhase)"'), 1);

// Reduced motion removes the animations entirely, not just pauses them.
const calm = paintAt('forest', ...PHONE, 0, true);
logic('reduced motion: no animate elements at all', countOf(calm, '<animate'), 0);
logic('reduced motion: scene still renders trees', countOf(calm, 'M0,-64') > 0, true);
logic('reduced motion: deer still present, just static', countOf(calm, 'M9.5,7.5 Q5.5,5 6,9.5'), 1);

logic('forest: no NaN with the living layers', dying.includes('NaN'), false);

// Pattern wallpapers were already full-bleed; make sure they stayed that way.
const pink = paintAt('pink', ...LAPTOP);
logic('pattern: fills 100% width', pink.includes('width:100%'), true);
logic('pattern: tiles bows', count(pink, '<pattern') , 2);

/* ── Voice: utterance parsing ──────────────────────────────────── */

const vCats = [
  { id: 'food', label: 'Food' },
  { id: 'shop', label: 'Shopping' },
  { id: 'pub', label: 'Public transport' },
  { id: 'hire', label: 'Private hire' },
];
const said = (t) => parseUtterance(t, vCats);
const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

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

logic('voice: yesterday resolves to a date', said('five dollars kopi yesterday').date, yest);
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

logic('ask: total this week', ask('how much did I spend this week').text, 'You spent S$45.00 this week.');
logic('ask: total this month defaults when no period given', ask('how much have I spent').text, 'You spent S$49.00 this month.');
logic('ask: total last month', ask('how much did I spend last month').text, 'You spent S$60.00 last month.');
logic('ask: total for a category', ask('how much on food this month').text, 'You spent S$44.00 on Food this month.');
logic('ask: biggest day', ask('which day did I spend the most').intent, 'topDay');
logic('ask: biggest day names the amount', ask('which day did I spend the most').text.includes('S$60.00'), true);
logic('ask: biggest day can be scoped to a period', ask('which day did I spend the most this month').text.includes('S$30.00'), true);
logic('ask: biggest week', ask('which week did I spend the most').intent, 'topWeek');
logic('ask: biggest week amount', ask('what week did I spend the most amount').text.includes('S$60.00'), true);
logic('ask: biggest week scoped to this month', ask('which week did I spend the most this month').text.includes('S$45.00'), true);
logic('ask: biggest month', ask('which month did I spend the most').text.includes('August'), true);
logic('ask: average per week', ask('what is my average spending per week').intent, 'avgWeek');
logic('ask: average per month', ask('average spending for the month').intent, 'avgMonth');
logic('ask: average per day', ask('how much do I spend on average a day').intent, 'avgDay');
logic('ask: top category all time', ask('what do I spend the most on').text.includes('Shopping'), true);
logic('ask: top category this month', ask('what do I spend the most on this month').text.includes('Food'), true);
logic('ask: count', ask('how many entries this month').text.includes('4'), true);
logic('ask: empty question', answer('', { expenses: sExp, cats: sCats }).intent, 'none');
logic('ask: unrecognised question is honest', ask('what is the meaning of life').intent, 'unknown');
logic('ask: no data for a period says so', answer('how much did I spend today', { expenses: sExp, cats: sCats, today: TODAY }).intent, 'empty');
logic('ask: no expenses at all is safe', answer('which day did I spend the most', { expenses: [], cats: sCats, today: TODAY }).intent, 'empty');

// The whole point of this design: arithmetic is exact, never approximated.
logic('ask: singular entry is not "1 entries"',
  ask('which day did I spend the most').detail.startsWith('1 entry'), true);
logic('ask: no stray space before the full stop',
  ask('what do I spend the most on').detail.includes(' .'), false);

logic('ask: reported total matches a direct sum',
  ask('how much did I spend this week').text.includes(
    'S$' + St.sum(St.inRange(sExp, '2026-09-28', '2026-09-30')).toFixed(2)), true);

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  ${c.ok ? '' : '→ ' + c.detail}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
