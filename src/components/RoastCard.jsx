import { useEffect, useRef } from 'react';
import { money } from '../lib/format';

/** Non-modal and never focused programmatically; the session owns dismissal. */
export default function RoastCard({ roast, onDismiss, onPause }) {
  const hovered = useRef(false), focused = useRef(false), pause = useRef(onPause);
  pause.current = onPause;
  useEffect(() => () => { pause.current?.(false); }, []);
  useEffect(() => { if (!roast) { hovered.current = false; focused.current = false; pause.current?.(false); } }, [roast?.id]);
  if (!roast) return null;
  const syncPause = () => pause.current?.(hovered.current || focused.current);
  return <section className="roast-popup" aria-label="Your spending roast"
    onMouseEnter={() => { hovered.current = true; syncPause(); }}
    onMouseLeave={() => { hovered.current = false; syncPause(); }}
    onFocusCapture={() => { focused.current = true; syncPause(); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; syncPause(); } }}>
    <button type="button" className="roast-dismiss" aria-label="Dismiss roast" onClick={onDismiss}>×</button>
    <p className="roast-purchase"><strong title={roast.description}>{roast.description}</strong><span className="money">{money(roast.amount)}</span></p>
    <p className="roast-text" role="status">{roast.status === 'loading' ? 'Saved. Finding a roast…' : roast.text}</p>
    {roast.status !== 'loading' && roast.source === 'offline' && <span className="roast-offline">Offline</span>}
  </section>;
}
