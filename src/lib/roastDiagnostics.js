/** Closed diagnostics only. Never copy messages, bodies, IDs or arbitrary codes. */
export const ROAST_CODES = [
  'roast_ok', 'roast_not_configured', 'roast_credentials_rejected',
  'roast_model_access_denied', 'roast_model_unavailable', 'roast_quota_exceeded',
  'roast_rate_limited', 'roast_timeout', 'roast_connection_failed',
  'roast_incomplete_output', 'roast_json_invalid', 'roast_server_output_invalid',
  'roast_client_output_invalid', 'roast_output_too_large', 'roast_input_invalid',
  'roast_provider_request_invalid', 'roast_provider_server_error', 'roast_unavailable',
  'roast_cancelled', 'roast_http_error',
];
export const COMPLETIONS = ['not_started', 'completed', 'incomplete', 'failed', 'cancelled', 'in_progress', 'queued', 'unknown'];
export const VALIDATIONS = ['none', 'shape', 'empty', 'length', 'control_characters', 'sentences', 'unsafe_markup', 'unsupported_history', 'unknown'];
export function roastDiagnostic(code, metadata = {}) {
  const { httpStatus = null, elapsedMs = 0, completion = 'unknown', incompleteReason = null, validation = 'none' } = metadata && typeof metadata === 'object' ? metadata : {};
  return {
    code: ROAST_CODES.includes(code) ? code : 'roast_unavailable',
    httpStatus: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0,
    completion: COMPLETIONS.includes(completion) ? completion : 'unknown',
    incompleteReason: ['max_output_tokens', 'content_filter'].includes(incompleteReason) ? incompleteReason : null,
    validation: VALIDATIONS.includes(validation) ? validation : 'unknown',
  };
}
