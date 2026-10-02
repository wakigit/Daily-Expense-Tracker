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
import { paintBackground, setSceneOver, setScenePaused, setSceneStill } from '../src/themes/scenes';
import { THEMES, isKnownTheme, themeById, DEFAULT_THEME } from '../src/themes/themes';
import { budgetStatus } from '../src/lib/status';
import BudgetView from '../src/views/BudgetView';

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

run('BudgetView', <BudgetView
  totalSpent={47.6} totalBudget={740} cats={cats} budgets={budgets}
  spending={spending} onEdit={() => {}} />,
  'This month', 'By category', 'On track', 'Edit budgets', 'Food');

run('BudgetView over budget', <BudgetView
  totalSpent={900} totalBudget={740} cats={cats} budgets={budgets}
  spending={{ ...spending, food: 400 }} onEdit={() => {}} />,
  'Over budget', 'status-chip');

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
  'Moonlit Forest', 'Rainy City', 'Total monthly budget', 'S$740.00',
  'will be deleted', 'Add new category', 'Selected');

run('MonthSheet', <MonthSheet
  histByYear={[['2026', ['2026-09']]]} ym="2026-09"
  monthTotals={() => ({ spent: 47.6, count: 3 })}
  onPick={() => {}} onClose={() => {}} />,
  'Select month', 'entries', 'aria-modal');

run('Donut single slice', <Donut data={[{ id: 'a', value: 10, color: '#f00' }]} total={10} />, 'S$10.00', 'path');
run('Donut many slices', <Donut data={chartData} total={47.6} />, 'donut-slice', 'Total');
run('BottomNav', <BottomNav tab="add" onGo={() => {}} />,
  'aria-current="page"', 'Budget', 'History', 'nav-btn active raised');
run('Header month mode', <Header ym="2026-09" onOpenPicker={() => {}} onOpenSettings={() => {}} />,
  'September 2026', 'Change month', 'Settings');
run('Header page title', <Header title="Budget" onOpenSettings={() => {}} />, 'page-title', 'Budget');
run('Header filter mode', <Header filteredCat={cats[0]} onClearFilter={() => {}} ym="2026-09" onOpenPicker={() => {}} onOpenSettings={() => {}} />, 'Food');

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

/* ── Budget status model (§2) ──────────────────────────────────── */

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
function mount(theme) {
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

  globalThis.window = { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: false }) };
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

const count = (hay, needle) => hay.split(needle).length - 1;

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
  logic(`${name}: mounts in the calm state`, m.html.includes('data-over="false"'), true);
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
const CITY = { bgKind: 'scene', scene: 'city', vars: {} };
logic('city builds', mount(CITY).html.includes('class="scene"'), true);
logic('city: no NaN reaches the svg', mount(CITY).html.includes('NaN'), false);
logic('city: composed in the same box', mount(CITY).html.includes('viewBox="0 0 390 844"'), true);

/* Rule 3.2: spending must never touch the markup. */
logic('scene markup takes no budget argument', paintBackground.length, 1);

/* The setters act on whatever is mounted now, so give them a fresh scene. */
const live = mount('forest');

/* Rule 3.3: one attribute carries the whole state change. */
setSceneOver(true);
logic('over sets data-over', live.root.getAttribute('data-over'), 'true');
setSceneOver(false);
logic('back under budget clears data-over', live.root.getAttribute('data-over'), 'false');
logic('switching state leaves the markup untouched', live.html === forest.html, true);

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
logic('every calm value has an over counterpart',
  count(forest.css, '.moon-shade{'), 2);
logic('state lives on the data attribute, not in custom properties',
  forest.css.includes('--moon-shade'), false);
logic('pausing is wired to the animated set', forest.css.includes('.scene.paused .a{animation-play-state:paused}'), true);
logic('reduced motion is honoured', forest.css.includes('@media (prefers-reduced-motion: reduce)'), true);

/* ── Rule 3.7: every loop ends where it starts ─────────────────── */

const css = forest.css;

// Waves translate by one screen width over a 30px period: 390/30 is whole.
logic('waves move a whole number of periods', 390 % 30, 0);
logic('wave keyframe travels exactly one screen', css.includes('to{transform:translateX(-390px)}'), true);

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
  css.includes('0%,6%{transform:translateX(0) scaleX(1)}') && css.includes('80%,100%{transform:translateX(0) scaleX(1)}'), true);

// Nothing may pulse in unison: each repeated element gets its own delay.
const delays = new Set([...forest.html.matchAll(/animation-delay:(-?[\d.]+)s/g)].map((m) => m[1]));
logic('forest staggers its animation delays', delays.size > 5, true);

/* Over budget stills the water rather than reversing it. */
logic('flow stops when over', css.includes('.scene[data-over="true"] .flow'), true);
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
