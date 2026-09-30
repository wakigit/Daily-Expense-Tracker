/** Money and date helpers. Singapore dollars, en-SG formatting. */

export const fmt = (n) => Number(n || 0).toFixed(2);

/** "S$12.50" — the one place currency formatting is decided. */
export const money = (n) => `S$${fmt(n)}`;

/** Signed money, for the "remaining" figure that can go negative. */
export const signedMoney = (n) => `${n < 0 ? '-' : ''}S$${fmt(Math.abs(n))}`;

export const today = () => new Date().toISOString().slice(0, 10);

export const curYm = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

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
