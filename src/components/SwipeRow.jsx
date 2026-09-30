import { useRef, useState } from 'react';

const REVEAL = 88;   // px of delete action exposed when snapped open
const COMMIT = 176;  // drag past this and it deletes on release
const ENGAGE = 8;    // px before we decide swipe-vs-scroll

/**
 * iOS-style swipe-to-delete.
 *
 * The hard part isn't the transform — it's not stealing vertical scroll.
 * On the first few pixels of movement we decide once whether this gesture is
 * a horizontal swipe or a vertical scroll, then commit to that decision for
 * the rest of the gesture. Without that lock, the list feels broken: every
 * attempt to scroll nudges rows sideways.
 *
 * Pointer events (not touch events) so the same code works for a mouse drag
 * on desktop, which also makes it testable without a phone.
 */
export default function SwipeRow({ open, onOpenChange, onDelete, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const g = useRef(null);
  /**
   * A pointerdown+pointerup on the same element fires a click even when the
   * pointer travelled a long way in between. Without this flag the click that
   * trails a swipe immediately re-closed the row we just opened — the gesture
   * silently undid itself. It also stops a drag that began on the edit/delete
   * button from firing that button.
   */
  const swallowClick = useRef(false);

  const resting = open ? -REVEAL : 0;
  const offset = dragging ? dx : resting;
  // Drives the opaque-face / visible-action styling.
  const active = dragging || open || removing;

  const commitDelete = () => {
    setRemoving(true);
    // Let the collapse animation play before the row leaves the list.
    setTimeout(onDelete, 240);
  };

  const onPointerDown = (ev) => {
    if (removing || ev.pointerType === 'mouse' && ev.button !== 0) return;
    g.current = { x: ev.clientX, y: ev.clientY, mode: null, from: resting };
  };

  const onPointerMove = (ev) => {
    if (!g.current || removing) return;
    const ddx = ev.clientX - g.current.x;
    const ddy = ev.clientY - g.current.y;

    if (g.current.mode === null) {
      if (Math.abs(ddx) < ENGAGE && Math.abs(ddy) < ENGAGE) return;
      // Whichever axis moved more wins, permanently.
      g.current.mode = Math.abs(ddx) > Math.abs(ddy) ? 'swipe' : 'scroll';
      if (g.current.mode === 'swipe') {
        setDragging(true);
        ev.currentTarget.setPointerCapture?.(ev.pointerId);
      }
    }
    if (g.current.mode !== 'swipe') return;

    ev.preventDefault?.();
    let next = g.current.from + ddx;
    if (next > 0) next = next * 0.25;                       // resist pulling right
    if (next < -COMMIT) next = -COMMIT - (-COMMIT - next) * 0.3; // rubber-band past commit
    setDx(next);
  };

  const onPointerUp = () => {
    if (!g.current) return;
    const mode = g.current.mode;
    const final = dx;
    g.current = null;

    if (mode !== 'swipe') { setDragging(false); return; }
    setDragging(false);
    swallowClick.current = true;

    if (final <= -COMMIT) { commitDelete(); return; }

    const shouldOpen = final < -REVEAL / 2;
    if (shouldOpen !== open) onOpenChange(shouldOpen);
    setDx(0);
  };

  return (
    <div className={`swipe-wrap${removing ? ' removing' : ''}${active ? ' active' : ''}`}>
      {/* Action layer sits behind and doesn't move. */}
      <div className="swipe-action" aria-hidden={!open}>
        <button
          className="swipe-delete"
          onClick={commitDelete}
          tabIndex={open ? 0 : -1}
        >
          Delete
        </button>
      </div>

      <div
        className={`swipe-face${dragging ? ' dragging' : ''}`}
        style={{ transform: `translate3d(${offset}px,0,0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Tapping an open row closes it rather than triggering what's beneath.
        onClickCapture={(ev) => {
          // The click that trails a swipe: drop it, change nothing.
          if (swallowClick.current) {
            swallowClick.current = false;
            ev.stopPropagation();
            ev.preventDefault();
            return;
          }
          // A genuine tap on an open row closes it instead of hitting what's beneath.
          if (open) { ev.stopPropagation(); ev.preventDefault(); onOpenChange(false); }
        }}
      >
        {children}
      </div>
    </div>
  );
}
