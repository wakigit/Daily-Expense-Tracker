import { useRef, useState } from 'react';
import { prepareImage } from '../lib/receiptImage';
import { requestReceipt, explainFailure } from '../lib/receiptClient';
import { describeMissing, printedTotal } from '../lib/receipt';
import Icon from './Icon';

/**
 * Fills the expense form from a photograph of a receipt.
 *
 * Like VoiceButton, it PRE-FILLS and never submits — and here the reason is
 * stronger. Speech mishears an amount; OCR reads the subtotal instead of the
 * total, loses a decimal point, and misreads the year, all while looking
 * completely confident. The person sees every field before it becomes a row.
 *
 * Fields the scan could not read are left alone rather than blanked, so a
 * partial read adds to the form instead of wiping it.
 *
 * `capture="environment"` asks a phone for the rear camera and is ignored on a
 * laptop, where the same control opens a file picker. One input, both.
 */
export default function ReceiptButton({ cats, today, onScanned }) {
  const inputRef = useRef(null);
  const [state, setState] = useState('idle');   // idle | working
  const [note, setNote] = useState('');
  // A warning is not a note. The foreign-currency case is the one outcome that
  // leaves a REQUIRED field empty on purpose, so it has to survive being
  // skim-read; the quiet grey line under the button does not.
  const [warn, setWarn] = useState('');
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    // Cleared immediately so choosing the SAME file twice fires change again —
    // otherwise a retry after a failed read silently does nothing.
    ev.target.value = '';
    if (!file) return;

    setState('working');
    setNote('');
    setWarn('');
    setError('');

    let image;
    try {
      image = await prepareImage(file);
    } catch (err) {
      setState('idle');
      setError(explainFailure(err?.code));
      return;
    }

    const res = await requestReceipt(image, { cats, today });
    setState('idle');

    if (!res.ok) {
      setError(explainFailure(res.reason));
      return;
    }

    onScanned(res.draft);

    // Say what was NOT filled in and what to do about it. The filled fields are
    // visible in the form directly below, so repeating them is noise; the gap
    // the person now has to close themselves is the part that is invisible.
    //
    // Foreign currency is reported first and on its own. It is the only case
    // where a field was deliberately left empty despite being read perfectly,
    // so saying "couldn't read the total" would be a lie — and the printed
    // figure is quoted, because converting it is now the person's job.
    if (res.draft.foreign) {
      const printed = printedTotal(res.draft);
      setWarn(
        printed
          ? `This receipt is in ${res.draft.currency} — printed total ${printed}. `
            + 'The amount has been left empty: convert it and type the Singapore '
            + 'dollar figure before saving.'
          : `This receipt is in ${res.draft.currency} and its total could not be read. `
            + 'The amount has been left empty: type the Singapore dollar figure '
            + 'before saving.'
      );
      return;
    }

    const gap = describeMissing(res.draft.missing);
    setNote(
      gap
        ? `Couldn't read ${gap} — add it below.`
        : 'Check the total before you save.'
    );
  };

  return (
    <div className="receipt">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        className={`voice-btn receipt-btn${state === 'working' ? ' working' : ''}`}
        onClick={pick}
        disabled={state === 'working'}
        aria-label={state === 'working' ? 'Reading receipt' : 'Fill the form from a photo of a receipt'}
      >
        <span className="voice-icon"><Icon name="receipt" size={17} /></span>
        <span>{state === 'working' ? 'Reading the receipt…' : 'Scan a receipt'}</span>
      </button>

      {state === 'working' && (
        <div className="receipt-scan" aria-hidden="true"><i /></div>
      )}

      {warn && state === 'idle' && (
        <p className="receipt-warn" role="alert">
          <Icon name="alert" size={15} />
          <span>{warn}</span>
        </p>
      )}
      {note && state === 'idle' && <p className="receipt-note">{note}</p>}
      {error && <p className="voice-error">{error}</p>}
    </div>
  );
}
