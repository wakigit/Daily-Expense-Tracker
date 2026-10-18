/**
 * GET /api/health — is the hosted backend up, and is a key configured?
 *
 * Reports whether a provider is configured but never what the key is. Useful
 * for telling "the deploy is broken" apart from "the deploy has no key and the
 * app is correctly falling back", which look identical from the frontend.
 */

import { handleHealth } from '../backend/src/routes.js';
import { isConfigured } from '../backend/src/provider.js';
import { sendJson } from './_shared.js';

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { error: 'method_not_allowed', allow: ['GET', 'HEAD'] });
  }
  const out = handleHealth();
  return sendJson(res, out.status, { ...out.body, providerConfigured: isConfigured() });
}
