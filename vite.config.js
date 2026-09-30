import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repo from a sub-path, not a domain root.
  // Without this, every built asset 404s and the page renders blank.
  base: '/Daily-Expense-Tracker/',
});
