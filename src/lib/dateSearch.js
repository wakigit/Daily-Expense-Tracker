import { validDate } from './queryContract.js';

const fullMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const invalid = () => ({ kind: 'invalid', message: 'Use a valid calendar date: YYYY-MM-DD, D/M/YYYY, or 17 Oct (optional year).' });

export function parseDateSearch(query, year) {
  const q = query.trim().toLowerCase();
  let date = null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(q)) {
    const [y, m, d] = q.split('-');
    date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    const slash = q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const named = q.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d+))?$/);
    if (slash) {
      date = `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
    } else if (named && (months.includes(named[2]) || fullMonths.includes(named[2]))) {
      if (named[3] && named[3].length !== 4) return invalid();
      const month = months.indexOf(named[2].slice(0, 3)) + 1;
      date = `${named[3] ?? year}-${String(month).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
    }
  }
  if (date) return validDate(date) ? { kind: 'date', date } : invalid();
  // Only numeric date-shaped input is a malformed date here. A number followed
  // by an ordinary word (7 Eleven, 20 dollars) must remain a text search.
  if (/^\d{4}-\d*(?:-\d*)?$|^\d+\/\d*(?:\/\d*)?$/.test(q)) return invalid();
  return { kind: 'text' };
}
