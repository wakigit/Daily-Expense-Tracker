/**
 * Money and date helpers. Singapore dollars, en-SG formatting.
 *
 * "Today" is the calendar day in Singapore, not in UTC and not on whatever
 * timezone the device happens to be set to. Those differ for eight hours of
 * every day: at 01:00 on the 6th in Singapore it is still the 5th in UTC, so
 * `toISOString().slice(0,10)` — what this used — dated every late-night and
 * early-morning expense to the day before. That is the exact window a student
 * logging supper is most likely to be using the app.
 */

const fmt = (n) => Number(n || 0).toFixed(2);

/** "S$12.50" — the one place currency formatting is decided. */
export const money = (n) => `S$${fmt(n)}`;

export const SG_TIMEZONE = 'Asia/Singapore';

// formatToParts rather than a formatted string: locale output order varies by
// ICU build, the parts do not.
const sgParts = new Intl.DateTimeFormat('en-US', {
  timeZone: SG_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Singapore, as YYYY-MM-DD. `now` is injectable for tests. */
export const today = (now = new Date()) => {
  const part = {};
  for (const { type, value } of sgParts.formatToParts(now)) part[type] = value;
  return `${part.year}-${part.month}-${part.day}`;
};

/** The calendar month in Singapore. Derived from the same day, so they agree. */
export const curYm = (now = new Date()) => today(now).slice(0, 7);

export const ymLabel = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' });
};

/** "3 Oct" — the short form used on transaction rows. */
export const dayLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });

export const shiftYm = (ym, dir) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + dir);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
