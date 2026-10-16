/**
 * Renders every scene at every decay level into one static page, for eyes only.
 *
 * It calls the real builders and the real stylesheet — no app, no React, no
 * iframes — so what it shows is what the wallpaper engine actually produces.
 * Written out to the scratchpad, never into the repo's build.
 *
 *   npx vite build --ssr scripts/scene-matrix.js --outDir .matrix-build
 *   node .matrix-build/scene-matrix.js > /path/to/matrix.html
 */
import { paintBackground } from '../src/themes/scenes';

function render(scene, wide = false) {
  let html = '';
  let css = '';
  globalThis.window = { innerWidth: wide ? 1440 : 390, innerHeight: wide ? 900 : 844, matchMedia: () => ({ matches: wide }) };
  globalThis.document = {
    documentElement: { clientWidth: 390, style: { setProperty: () => {} } },
    head: { appendChild: (el) => { css = el.textContent; } },
    createElement: () => ({ textContent: '' }),
    getElementById: (id) => (id === 'bg' ? { set innerHTML(v) { html = v; } } : null),
    querySelector: () => null,
  };
  paintBackground({ bgKind: 'scene', scene });
  return { html, css };
}

const scenes = ['forest', 'beach', 'city'];
const levels = [['0', 'healthy'], ['1', 'strained'], ['2', 'run down']];
const { css } = render('forest');

const WIDE = process.argv.includes('--wide');
const cells = scenes.map((s) => {
  const { html } = render(s, WIDE);
  return `<tr><th>${s}</th>` + levels.map(([n]) =>
    // The engine fixes the scene to the viewport; inside a panel it has to be
    // absolute instead, and the panel supplies the 390x844 frame it expects.
    `<td><div class="panel" id="bg">${html.replace('class="scene"', `class="scene" data-decay="${n}"`)}</div></td>`
  ).join('') + '</tr>';
}).join('');

process.stdout.write(`<!doctype html><meta charset=utf-8><title>scene matrix</title>
<style>
body{margin:0;background:#0b0d12;color:#c6ccda;font:12px system-ui;padding:10px}
th{font-weight:600;padding:4px 8px;text-align:left}
td{padding:4px}
${WIDE
  ? '.panel{position:relative;width:432px;height:270px;overflow:hidden;border:1px solid #222838;border-radius:6px}\n.panel .scene{position:absolute!important;top:0;left:0!important;width:432px!important;height:270px!important;min-width:0!important;transform:none!important;aspect-ratio:auto!important}'
  : '.panel{position:relative;width:273px;height:364px;overflow:hidden;border:1px solid #222838;border-radius:6px}\n.panel .scene{position:absolute!important;top:0;left:0!important;height:591px!important;width:273px!important;min-width:0!important;transform:none!important;aspect-ratio:auto!important}'}
${css}
</style>
<table><tr><th></th>${levels.map(([n, l]) => `<th>${n} — ${l}</th>`).join('')}</tr>${cells}</table>
`);
