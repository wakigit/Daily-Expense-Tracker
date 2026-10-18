/** Date-only UTC arithmetic, independent of the machine timezone and DST. */
export function shiftCalendarDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calendarWeekStart(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftCalendarDate(date, -((day + 6) % 7));
}
