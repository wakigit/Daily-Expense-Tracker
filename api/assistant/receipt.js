/**
 * POST /api/assistant/receipt — the receipt scanner, as a Vercel Function.
 *
 * The expensive one: every call sends an image to a vision model. It gets the
 * tighter limit for that reason, and the same decoded-size cap and MIME
 * allowlist the local server enforces, because they live in the shared module
 * rather than here.
 */

import { handleReceipt, MAX_IMAGE_BODY_BYTES } from '../../backend/src/routes.js';
import { withGuards } from '../_shared.js';

/* 6 a minute per IP. Scanning is deliberate — pick a photo, wait for a draft,
   check it — so a real person never approaches this. */
export default withGuards({ maxBytes: MAX_IMAGE_BODY_BYTES, limit: 6, handler: handleReceipt });
