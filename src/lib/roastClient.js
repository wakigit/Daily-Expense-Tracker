import { roastDiagnostic } from './roastDiagnostics';
import { ASSISTANT_URL } from './assistantClient';
import { validateRoastInput, validateRoastOutput } from './roastContract';

export async function requestRoast(input, { signal, fetchImpl = fetch, url = ASSISTANT_URL, timeoutMs = 10_000 } = {}) {
  const started = performance.now();
  let finalReply;
  const finish = (code, metadata = {}, text) => {
    if (finalReply) return finalReply;
    const diagnostic = roastDiagnostic(code, { ...metadata, elapsedMs: performance.now() - started });
    console.info('[roast diagnostic]', JSON.stringify(diagnostic));
    finalReply = text === undefined ? { ok: false, diagnostic } : { ok: true, text, diagnostic };
    return finalReply;
  };
  if (!validateRoastInput(input).ok) return finish('roast_input_invalid', { completion: 'not_started' });
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer;
  try {
    // Race as well as abort: even a fetch implementation that ignores signals is bounded.
    return await Promise.race([
      (async () => {
        const res = await fetchImpl(`${url}/assistant/roast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal });
        if (Number(res.headers?.get('content-length')) > 2048) return finish('roast_output_too_large', { httpStatus: res.status });
        const reader = res.body?.getReader();
        let raw;
        if (reader) {
          const chunks = []; let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2048) { await reader.cancel(); return finish('roast_output_too_large', { httpStatus: res.status }); }
            chunks.push(value);
          }
          const bytes = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { return finish('roast_json_invalid', { httpStatus: res.status }); }
        } else { try { raw = await res.json(); } catch { return finish('roast_json_invalid', { httpStatus: res.status }); } }
        if (!res.ok) return finish(raw?.diagnostic?.code ?? 'roast_http_error', { ...roastDiagnostic(raw?.diagnostic?.code, raw?.diagnostic), httpStatus: raw?.diagnostic?.httpStatus ?? res.status });
        const metadata = raw?.diagnostic ? roastDiagnostic(raw.diagnostic.code, raw.diagnostic) : { httpStatus: res.status };
        const allowed = raw && Object.keys(raw).every(key => ['text', 'diagnostic'].includes(key));
        const output = validateRoastOutput(allowed ? { text: raw.text } : raw, input);
        return output.ok ? finish('roast_ok', metadata, output.text) : finish('roast_client_output_invalid', { ...metadata, validation: output.reason });
      })(),
      new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(finish('roast_timeout')); }, timeoutMs); }),
    ]);
  } catch { return finish(signal?.aborted ? 'roast_cancelled' : 'roast_connection_failed'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
