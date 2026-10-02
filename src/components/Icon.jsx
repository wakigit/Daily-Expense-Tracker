/**
 * The small UI glyphs, as inline SVG.
 *
 * These were emoji until the redesign. Emoji render differently on every
 * platform, ignore the theme's colours, and cannot be sized against the type
 * scale — all three show up badly against a wallpaper. SVG inherits
 * currentColor, so a glyph is always the colour of the text it sits beside.
 */
const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  check: <><path d="M20 6L9 17l-5-5" /></>,
  edit: <><path d="M4 20h4L19 9a2.5 2.5 0 10-3.5-3.5L4.5 16.5z" /><path d="M14.5 6.5L17.5 9.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4.5h6V7" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></>,
};

export default function Icon({ name, size = 18 }) {
  const d = PATHS[name];
  if (!d) return null;
  return <svg {...BASE} width={size} height={size}>{d}</svg>;
}
