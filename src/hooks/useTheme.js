import { useEffect } from 'react';
import { themeById } from '../themes/themes';
import { paintBackground } from '../themes/scenes';

/**
 * Applies a theme's CSS custom properties to :root and paints the wallpaper.
 *
 * `health` (0 = budget untouched, 1 = spent or over) makes the scene react:
 * the forest moon wanes, the beach sun sinks. It is in the dependency array,
 * so the wallpaper repaints whenever spending moves.
 *
 * Scene wallpapers are sized to the viewport, so they alone need a resize
 * listener; pattern wallpapers tile and don't care. The rAF coalesces the
 * burst of resize events iOS fires when the keyboard opens or the URL bar
 * collapses, which would otherwise repaint the whole SVG dozens of times.
 */
export function useTheme(themeId, health = 0) {
  useEffect(() => {
    const theme = themeById(themeId);
    Object.entries(theme.vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
    paintBackground(theme, health);

    // Keep the iOS status bar / browser chrome in step with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.vars['--bg']);

    if (theme.bgKind !== 'scene') return;

    let raf = null;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => paintBackground(theme, health));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [themeId, health]);
}
