/** The five bottom-nav glyphs, as inline SVG so they inherit currentColor. */
export default function NavIcon({ id }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    width: 24,
    height: 24,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (id === 'home')
    return (
      <svg {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );

  if (id === 'history')
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );

  if (id === 'ask')
    return (
      <svg {...props}>
        <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    );

  if (id === 'add')
    return (
      <svg {...props}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );

  if (id === 'budget')
    return (
      <svg {...props}>
        <path d="M3 7.5A2.5 2.5 0 015.5 5H18a2 2 0 012 2v10a2 2 0 01-2 2H5.5A2.5 2.5 0 013 16.5z" />
        <path d="M20 10.5h-3.2a1.75 1.75 0 000 3.5H20" />
      </svg>
    );

  return null;
}
