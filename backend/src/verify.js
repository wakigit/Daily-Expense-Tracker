/**
 * Pre-flight: is the key accepted, and is the configured model available?
 *
 * Run with `npm run verify` from backend/. Prints presence and outcomes only —
 * it never prints the key, and never any part of it.
 */

import { MODEL, DEFAULT_MODEL, isConfigured, verifyModel } from './provider.js';

const line = (label, value) => console.log(`${label.padEnd(22)} ${value}`);

console.log('\nOpenAI configuration check\n');
line('OPENAI_API_KEY', isConfigured() ? 'present' : 'MISSING');
line('OPENAI_MODEL', `${MODEL}${MODEL === DEFAULT_MODEL ? '  (default)' : ''}`);

if (!isConfigured()) {
  console.log(`
OPENAI_API_KEY is not set, so nothing could be checked against the API.

  cd backend
  cp .env.example .env        # then put the key in .env — never in the repo
  node --env-file=.env src/verify.js

The app runs without it: the assistant falls back to its offline matcher.
`);
  process.exit(1);
}

const result = await verifyModel();
if (result.ok) {
  line('model available', `yes — ${result.model}`);
  console.log('\nReady.\n');
} else {
  line('model available', 'NO');
  line('reason', result.reason);
  console.log(`
  ${result.hint}

Nothing else in the app is blocked by this — the assistant falls back.
`);
  process.exit(1);
}
