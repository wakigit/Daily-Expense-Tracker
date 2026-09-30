/**
 * Thin wrapper over the Web Speech API.
 *
 * PLATFORM NOTE: support is good in Chrome and Safari 14.1+, but it is a
 * browser feature, not ours — it needs a user gesture to start, prompts for
 * microphone permission, and on some builds routes audio to a server for
 * recognition. Every entry point is guarded and the UI hides itself entirely
 * when `isSupported()` is false, so an unsupported browser sees no dead button.
 */

const Recognition = () =>
  (typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const isSupported = () => Recognition() !== null;

/**
 * Listens once and resolves with the transcript.
 * Rejects with a short, user-showable reason.
 */
export function listenOnce({ onPartial } = {}) {
  const Ctor = Recognition();
  if (!Ctor) return Promise.reject(new Error('unsupported'));

  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = 'en-SG';
    rec.interimResults = true;   // lets the UI show words as they land
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let finalText = '';
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onPartial?.((finalText + interim).trim());
    };

    rec.onerror = (ev) => {
      const map = {
        'not-allowed': 'Microphone permission denied',
        'service-not-allowed': 'Microphone permission denied',
        'no-speech': "Didn't catch that",
        'audio-capture': 'No microphone found',
        network: 'Speech recognition needs a connection',
      };
      done(reject, new Error(map[ev.error] || 'Could not hear you'));
    };

    rec.onend = () => {
      const text = finalText.trim();
      if (text) done(resolve, text);
      else done(reject, new Error("Didn't catch that"));
    };

    try {
      rec.start();
    } catch {
      done(reject, new Error('Could not start listening'));
    }

    // Hand back a stopper so the UI can cancel.
    resolve.stop = () => rec.stop();
  });
}
