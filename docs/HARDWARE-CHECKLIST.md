# Physical microphone and receipt checks

Status: awaiting Wei Kai's physical input. Automated transcript tests are not microphone tests.

## Isolate data

Laptop: use the isolated test origin `http://127.0.0.1:5186/Daily-Expense-Tracker/` while its test server is running. Confirm its ledger is empty first. The existing `localhost:5185` tab can contain your real ledger, so do not use or clear that tab for disposable tests. Leave every result as an unsaved draft. Receipt testing sends the selected photo to OpenAI. Select only a receipt you choose to test. Never attach personal receipt images to this repository or to published screenshots.

Phone: local HTTP over Wi-Fi is not a secure microphone context. Use the existing HTTPS Vercel Preview after signing into the owning Vercel account in Safari, or an HTTPS development setup approved by you. This stage does not deploy changes. A 390px Chrome viewport is a layout check, not an iPhone microphone check. Report the actual phone browser and whether the microphone button appears.

## Voice, run on laptop and physical phone

1. Add, type a fictional description and notes first. Tap microphone, allow permission, say “Six dollars fifty for Food yesterday”. Expected: amount 6.50, Food, yesterday's Singapore date. Check transcript and all fields before saving. Record which existing fields changed.
2. Speak another fictional decimal amount and an explicit real custom category. Expected: that category, correct decimal.
3. Speak an unclear amount. Expected: no invented amount; inspect the draft. Never save a guess. If the recognizer emits a clear but wrong transcript, correct it manually.
4. Deny microphone permission using your browser's site settings, then try again with fields already filled. Expected: clear safe failure, pre-existing fields preserved. Restore your permission preference afterward.
5. Do not press Save. Report results as: device/browser, utterance, transcript, amount/category/date, changed existing fields, error.

## Receipts, select photos yourself

Start each case with a fictional description, amount and notes in the form. Tap Scan receipt and select your chosen photograph. Keep it as a draft.

- Ordinary receipt: verify printed merchant, final total, currency, date and suggested category.
- Subtotal + GST/service charge: verify final paid total is used once, not subtotal and not sum of all printed numbers.
- Less-clear photo: unreadable fields should remain unknown, not be invented. Failure should preserve the existing form. Successful partial drafts merge readable fields; review any retained values carefully.
- Non-SGD: currency warning, no automatic currency conversion, amount cleared for manual SGD entry. Unknown receipt category may clear the previous category so it is explicitly reviewed. Existing notes are retained.

Current contract extracts receipt-level merchant/description, final amount, currency, date and category, plus whether the image is a receipt. It does not extract individual items. Scanning never saves automatically.

Report each case's printed versus draft fields, warnings and whether existing fields survived. Do not send receipt photos or personal details in the report. Cancel drafts afterward.
