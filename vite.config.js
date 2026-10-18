import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Two hosts, two shapes.
 *
 * GitHub Pages serves this repo from a sub-path, so assets need the repo name
 * in front of them or every one of them 404s and the page renders blank. A
 * Vercel deployment is its own origin and serves from the root, where that
 * same prefix would be the thing that breaks it.
 *
 * Vercel sets VERCEL=1 during the build, so neither host has to be told about
 * the other, and VITE_BASE overrides both.
 *
 * The backend base is decided here too, and deliberately NOT left to
 * vercel.json's `build.env`: a first deploy proved that route does not reach
 * Vite's `import.meta.env`, and the bundle shipped pointing at
 * 127.0.0.1:8787 — which on a visitor's phone is the visitor's own phone.
 * Setting it on process.env before the config is read is the one place that
 * works for every way this gets built. */
const onVercel = !!process.env.VERCEL;

if (onVercel && !process.env.VITE_ASSISTANT_URL) {
  // Same origin: the Functions in /api are served by this deployment.
  process.env.VITE_ASSISTANT_URL = '/api';
}

const base = process.env.VITE_BASE ?? (onVercel ? '/' : '/Daily-Expense-Tracker/');

export default defineConfig({
  plugins: [react()],
  base,
});
