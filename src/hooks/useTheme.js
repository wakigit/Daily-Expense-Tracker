import { useEffect, useState } from 'react';
import { themeById } from '../themes/themes';
import { paintBackground, setSceneDecay, setScenePaused, setSceneStill, isWide, WIDE_QUERY } from '../themes/scenes';

/**
 * Applies a theme's CSS custom properties to :root and mounts the wallpaper.
 *
 * The three effects below are deliberately separate, and the split IS the
 * feature. Building the scene is expensive and restarts every animation, so it
 * depends on the theme alone. Budget state and pausing are attribute flips on
 * an element that is already mounted, so logging an expense no longer makes the
 * deer teleport or the rain stutter.
 *
 * `decay` is the whole budget signal the scene gets: one number, 0 to 2, from
 * `decayLevel()` in lib/status.js. The scene is healthy, strained, or run down,
 * and it eases between them in either direction — spend more and the world
 * wears out, delete the expense and it recovers.
 */
export function useTheme(themeId, { decay = 0, paused = false, still = false, motion = 'auto' } = {}) {
  /* Which composition is mounted. Crossing the laptop breakpoint is the only
     other thing that forces a rebuild, and a rebuild restarts every loop — but
     at that exact moment the whole layout is changing anyway, so the restart is
     invisible. Dragging a window across 1024px is the only way to see it.

     Mounting both compositions and swapping with display:none would avoid even
     that, at the cost of doubling the element count on phones, which is the
     constrained device. Not worth it for a transition nobody watches. */
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ── Build: theme and composition only.
  useEffect(() => {
    const theme = themeById(themeId);
    Object.entries(theme.vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
    paintBackground(theme);

    // Keep the iOS status bar / browser chrome in step with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.vars['--ground']);
  }, [themeId, wide]);

  // ── Motion: 'on' opts out of the reduced-motion rules, 'auto' defers to the
  // system. Stamped on :root because the rules it unlocks are global, not just
  // the scene's — the card entrance animation reads it too.
  useEffect(() => {
    document.documentElement.setAttribute('data-motion', motion === 'on' ? 'on' : 'auto');
  }, [motion]);

  // ── State: re-applied after a rebuild, hence themeId in the deps.
  useEffect(() => { setSceneDecay(decay); }, [decay, themeId, wide]);
  useEffect(() => { setSceneStill(still); }, [still, themeId, wide]);

  // ── Pausing: off the Home tab, or whenever the tab is in the background.
  useEffect(() => {
    const apply = () => setScenePaused(paused || document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [paused, themeId, wide]);
}
