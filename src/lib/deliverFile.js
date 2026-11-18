/**
 * The one impure half of export: actually getting a file to the user.
 *
 * Kept apart from dataExport.js so that everything which decides WHAT is in the
 * file stays pure and testable, and only the handing-over lives here. The
 * choice of route is still made by the pure `deliveryMethod`; this file only
 * reports the environment and performs what it is told.
 *
 * It never reports success. Whether a file was really saved is known to the
 * operating system and to nobody else, so the caller says "check your
 * Downloads or Files" and stops there.
 */

import { deliveryMethod } from './dataExport.js';

/**
 * A home-screen web app, by capability rather than user-agent sniffing.
 * `display-mode: standalone` is the standard signal; `navigator.standalone` is
 * the older iOS-only one, and iOS is exactly where this matters.
 */
export function detectEnv() {
  const standalone = Boolean(
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && navigator.standalone === true),
  );
  let canShareFiles = false;
  try {
    canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && typeof File === 'function'
      && navigator.canShare({ files: [new File(['probe'], 'probe.txt', { type: 'text/plain' })] });
  } catch {
    canShareFiles = false;
  }
  return { standalone, canShareFiles };
}

/**
 * Hands `text` over as `name`, and returns what route was taken plus, for the
 * text route, the content the caller must display for copying.
 *
 * A failed share is not an error worth shouting about — the user may simply
 * have dismissed the sheet — but a failure to even start is, so a thrown share
 * falls through to the copyable text rather than leaving nothing.
 */
export async function deliverFile({ name, text, mime }, env = detectEnv()) {
  const method = deliveryMethod(env);

  if (method === 'share') {
    try {
      await navigator.share({ files: [new File([text], name, { type: mime })], title: name });
      return { method: 'share', name };
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'share', name, dismissed: true };
      return { method: 'text', name, text };
    }
  }

  if (method === 'download') {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on a later tick: Safari has needed the URL to outlive the click.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return { method: 'download', name };
    } catch {
      return { method: 'text', name, text };
    }
  }

  return { method: 'text', name, text };
}
