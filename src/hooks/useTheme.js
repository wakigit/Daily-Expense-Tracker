import { useEffect } from 'react';
import { themeById } from '../themes/themes';
import { paintBackground, setSceneOver, setScenePaused, setSceneStill } from '../themes/scenes';

/**
 * Applies a theme's CSS custom properties to :root and mounts the wallpaper.
 *
 * The three effects below are deliberately separate, and the split IS the
 * feature. Building the scene is expensive and restarts every animation, so it
 * depends on the theme alone. Budget state and pausing are attribute flips on
 * an element that is already mounted, so logging an expense no longer makes the
 * deer teleport or the rain stutter.
 *
 * `isOver` is the whole budget signal the scene gets: one boolean, per §2 of
 * the redesign spec. There is no gradient of health any more — the scene is
 * calm, or it is over.
 */
export function useTheme(themeId, { isOver = false, paused = false, still = false } = {}) {
  // ── Build: theme changes only.
  useEffect(() => {
    const theme = themeById(themeId);
    Object.entries(theme.vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
    paintBackground(theme);

    // Keep the iOS status bar / browser chrome in step with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.vars['--bg']);
  }, [themeId]);

  // ── State: re-applied after a rebuild, hence themeId in the deps.
  useEffect(() => { setSceneOver(isOver); }, [isOver, themeId]);
  useEffect(() => { setSceneStill(still); }, [still, themeId]);

  // ── Pausing: off the Home tab, or whenever the tab is in the background.
  useEffect(() => {
    const apply = () => setScenePaused(paused || document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [paused, themeId]);
}
