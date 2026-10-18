/**
 * POST /api/assistant/intent — the typed Assistant, as a Vercel Function.
 *
 * All of the thinking is in backend/src/routes.js, which the local node:http
 * server runs too. This file exists to give that code an address on Vercel.
 */

import { handleIntent, MAX_BODY_BYTES } from '../../backend/src/routes.js';
import { withGuards } from '../_shared.js';

/* 20 a minute per IP. A person asking questions sends one every few seconds;
   anything at this rate is a script. Best-effort — see api/_shared.js. */
export default withGuards({ maxBytes: MAX_BODY_BYTES, limit: 20, handler: handleIntent });
