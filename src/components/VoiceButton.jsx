import { useState } from 'react';
import { isSupported, listenOnce } from '../lib/speech';
import { parseUtterance } from '../lib/parseUtterance';
import Icon from './Icon';

/**
 * Mic button that fills the expense form from speech.
 *
 * It PRE-FILLS and never submits. Speech recognition mishears amounts, and an
 * expense recorded from a misheard number is worse than no shortcut at all —
 * the user always sees the parsed fields before they become a row.
 */
export default function VoiceButton({ cats, onParsed }) {
  const [state, setState] = useState('idle');   // idle | listening | error
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');

  if (!isSupported()) return null;

  const start = async () => {
    setState('listening');
    setHeard('');
    setError('');
    try {
      const transcript = await listenOnce({ onPartial: setHeard });
      const fields = parseUtterance(transcript, cats);
      setHeard(transcript);
      setState('idle');
      if (Object.keys(fields).length === 0) {
        setError("Didn't catch an amount — try “four fifty for chicken rice”");
        return;
      }
      onParsed(fields, transcript);
    } catch (err) {
      setState('error');
      setError(err.message || 'Could not hear you');
    }
  };

  return (
    <div className="voice">
      <button
        type="button"
        className={`voice-btn${state === 'listening' ? ' listening' : ''}`}
        onClick={start}
        disabled={state === 'listening'}
        aria-label={state === 'listening' ? 'Listening' : 'Add expense by voice'}
      >
        <span className="voice-icon"><Icon name="mic" size={17} /></span>
        <span>{state === 'listening' ? 'Listening…' : 'Say it instead'}</span>
      </button>

      {state === 'listening' && (
        <div className="voice-wave" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
      )}

      {heard && state !== 'error' && (
        <p className="voice-heard">“{heard}”</p>
      )}
      {error && <p className="voice-error">{error}</p>}
    </div>
  );
}
