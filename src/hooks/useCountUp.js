import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Eases a number toward its new value instead of snapping.
 *
 * Used on the headline totals: watching the figure climb makes the app feel
 * responsive and considered. Everything else shows exact values immediately —
 * animating every number would be noise, not polish.
 */
export function useCountUp(target, duration = 620) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    if (reducedMotion()) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (Math.abs(delta) < 0.005) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      // easeOutCubic — fast start, gentle settle.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}
