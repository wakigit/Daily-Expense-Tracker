/**
 * Turns a validated intent into a PLAN — never into a change.
 *
 * Two rules, and the whole file exists to enforce them:
 *
 * 1. Every spending figure is computed here, by lib/stats.js, over the real
 *    rows. The model chose which question was being asked; it never supplied a
 *    number, and no number it supplied would be used if it did.
 *
 * 2. Nothing that alters data happens in this file. A proposed add or delete
 *    comes back as a plan with `needsConfirmation: true` and the exact figures
 *    to show. App.jsx applies it through lib/actions.js only after a person has
 *    pressed Confirm.
 *
 * Pure: no React, no storage, no network, no clock beyond the `today` passed in.
 */

import * as St from './stats';
import { money, dayLabel, ymLabel } from './format';
import { findDuplicate, normaliseDescription, validateExpense } from './actions';
import { toCents } from './money';

/** The model's own sentence, used only as a preamble — never as a figure. */
const preamble = (intent) => (intent.say ? `${intent.say} ` : '');

/* ── Answering ─────────────────────────────────────────────────── */

/**
 * Catches SOME cases of a question being silently narrowed.
 *
 * Found live: with only Food defined, "groceries and entertainment" came back
 * as `category: food`. Both the figure and the sentence would have looked
 * right, and the answer would have been to a question nobody asked.
 *
 * Read the limit of this honestly. `categoryTerms` is reported BY THE MODEL.
 * This compares the terms it listed against what it mapped them to, so it
 * catches the case where the model admits to seeing two things and picks one.
 * It cannot catch the case where the model fails to list a term at all — if it
 * returns `categoryTerms: []` and a confident `category`, this sees nothing
 * wrong. That is a mitigation, not a guarantee, and no amount of checking on
 * this side can turn it into one.
 *
 * Which is why every answer now carries its interpretation to the screen: the
 * last line of defence is the person reading it seeing "Food · this month" when
 * they asked about something else.
 */
function categoryTrouble({ category, categoryTerms = [] }, cats) {
  const names = cats.map((c) => c.label).join(', ');

  if (categoryTerms.length > 1) {
    return {
      kind: 'clarify',
      question: `I can only look at one category at a time, and that mentions ${categoryTerms.length}: ${categoryTerms.join(', ')}. Which should I use?`,
      options: cats.map((c) => c.label),
    };
  }

  // One term named, nothing it maps to. Answering "all categories" would be a
  // different question; answering with the only category would be a narrower one.
  if (categoryTerms.length === 1 && category === null) {
    return {
      kind: 'clarify',
      question: `I don't have a category for "${categoryTerms[0]}". Which of these did you mean? ${names}`,
      options: cats.map((c) => c.label),
    };
  }

  return null;
}

function planAnswer(intent, { expenses, cats, today }) {
  const { metric, period: periodName, category } = intent.query;

  const trouble = categoryTrouble(intent.query, cats);
  if (trouble) return trouble;

  const win = St.period(periodName, today);

  let rows = St.inRange(expenses, win.start, win.end);
  const cat = category ? cats.find((c) => c.id === category) : null;
  if (cat) rows = rows.filter((e) => e.category === cat.id);

  const scope = cat ? `${cat.label.toLowerCase()} ${win.label}` : win.label;

  // Shown beside the answer so a misreading is visible rather than implied by
  // a sentence that reads perfectly well either way.
  const interpretation = {
    category: cat ? cat.label : 'All categories',
    period: win.label,
  };

  if (!rows.length) {
    return {
      kind: 'answer',
      text: `I don't have any expenses recorded for ${scope} yet.`,
      interpretation,
    };
  }

  const say = (text, detail) => ({ kind: 'answer', text, detail, interpretation });

  switch (metric) {
    case 'total':
      return say(`You spent ${money(St.sum(rows))} ${scope}.`,
        `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`);

    case 'count':
      return say(`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} ${scope}.`);

    case 'top_day': {
      const peak = St.topDay(rows);
      return peak
        ? say(`${dayLabel(peak.key)} was the most, at ${money(peak.value)}.`, `Across ${scope}`)
        : say(`I don't have enough to compare days ${scope}.`);
    }

    case 'top_week': {
      const peak = St.topWeek(rows);
      return peak
        ? say(`The week of ${dayLabel(peak.key)} was the most, at ${money(peak.value)}.`)
        : say(`I don't have enough to compare weeks ${scope}.`);
    }

    case 'top_month': {
      const peak = St.topMonth(rows);
      return peak
        ? say(`${ymLabel(peak.key)} was the most, at ${money(peak.value)}.`)
        : say(`I don't have enough to compare months ${scope}.`);
    }

    case 'top_category': {
      const peak = St.topCategory(rows);
      if (!peak) return say(`I don't have enough to compare categories ${scope}.`);
      const label = cats.find((c) => c.id === peak.key)?.label ?? peak.key;
      return say(`${label} is the most, at ${money(peak.value)} ${scope}.`);
    }

    case 'average_per_day':
      return say(`About ${money(St.averagePerDay(rows, win))} a day ${scope}.`);
    case 'average_per_week':
      return say(`About ${money(St.averagePerWeek(rows, win))} a week ${scope}.`);
    case 'average_per_month':
      return say(`About ${money(St.averagePerMonth(rows, win))} a month ${scope}.`);

    default:
      // validateIntent already rejects unknown metrics; this is the belt.
      return { kind: 'answer', text: "I'm not sure how to work that one out yet." };
  }
}

/* ── Proposing an add ──────────────────────────────────────────── */

function planAdd(intent, { expenses, cats, today }) {
  // The same validator the form uses, with the assistant's stricter rules:
  // it must name a real category rather than defaulting into one.
  const checked = validateExpense(intent.expense, { cats, today, requireCategory: true });
  if (!checked.ok) {
    return { kind: 'clarify', question: questionFor(checked.error, cats), error: checked.error };
  }

  const duplicate = findDuplicate(expenses, checked.value);
  const label = cats.find((c) => c.id === checked.value.category)?.label ?? checked.value.category;

  return {
    kind: 'confirm_add',
    needsConfirmation: true,
    expense: checked.value,
    summary: `${checked.value.description} · ${money(checked.value.amount)} · ${label} · ${dayLabel(checked.value.date)}`,
    text: `${preamble(intent)}Add this?`,
    duplicate: duplicate
      ? { id: duplicate.id, summary: `${duplicate.description} · ${money(duplicate.amount)} · ${dayLabel(duplicate.date)}` }
      : null,
  };
}

/** Turns a validation failure into something worth saying out loud. */
function questionFor(error, cats) {
  const names = cats.map((c) => c.label).join(', ');
  switch (error.code) {
    case 'category_required':
      return `Which category should that go in? ${names}`;
    case 'category_unknown':
      return `I don't have a category called "${error.category}". Pick one: ${names}`;
    case 'amount_required':
    case 'amount_invalid':
      return 'How much was it?';
    case 'amount_not_positive':
      return 'That amount has to be more than zero — how much was it?';
    case 'amount_too_large':
      return 'That looks too large to be right. How much was it?';
    case 'description_required':
      return 'What was it for?';
    case 'date_invalid':
      return 'I could not read that date. Which day was it?';
    default:
      return 'I need a bit more to go on.';
  }
}

/* ── Proposing a delete ────────────────────────────────────────── */

/**
 * Resolves the model's filter against the REAL rows.
 *
 * The model never supplies an id to delete. It describes what it thinks you
 * meant; this searches for matches and hands them back for you to pick. A
 * hallucinated id that happened to exist would otherwise delete the wrong row.
 */
function planDelete(intent, { expenses, cats }) {
  const { description, amount, date, category } = intent.filter;
  const needle = description ? normaliseDescription(description) : null;
  const wantCents = amount == null ? null : toCents(amount);

  const candidates = expenses.filter((e) => {
    if (needle && !normaliseDescription(e.description).includes(needle)) return false;
    if (wantCents != null && toCents(e.amount) !== wantCents) return false;
    if (date && e.date !== date) return false;
    if (category && e.category !== category) return false;
    return true;
  });

  const describe = (e) => {
    const label = cats.find((c) => c.id === e.category)?.label ?? e.category;
    return { id: e.id, summary: `${e.description} · ${money(e.amount)} · ${label} · ${dayLabel(e.date)}` };
  };

  if (!candidates.length) {
    return { kind: 'answer', text: "I couldn't find an expense matching that." };
  }

  // One match still gets confirmed. Deleting on a single guess is the failure
  // that costs someone real data.
  return {
    kind: 'confirm_delete',
    needsConfirmation: true,
    candidates: candidates.map(describe),
    text: candidates.length === 1
      ? `${preamble(intent)}Delete this?`
      : `${preamble(intent)}I found ${candidates.length} that match. Which one?`,
  };
}

/* ── Entry point ───────────────────────────────────────────────── */

/**
 * @returns a plan. `confirm_add` and `confirm_delete` carry
 *   `needsConfirmation: true` and change nothing on their own.
 */
export function planFromIntent(intent, { expenses = [], cats = [], today = '', actionLog = [] } = {}) {
  switch (intent.type) {
    case 'answer':
      return planAnswer(intent, { expenses, cats, today });

    case 'propose_add':
      return planAdd(intent, { expenses, cats, today });

    case 'find_delete_candidates':
      return planDelete(intent, { expenses, cats });

    case 'undo': {
      const undoable = actionLog.some((a) => a.source === 'assistant');
      return undoable
        ? { kind: 'undo', scope: intent.scope }
        : { kind: 'answer', text: "I haven't changed anything yet, so there's nothing to undo." };
    }

    case 'clarify':
      return { kind: 'clarify', question: intent.question, options: intent.options ?? [] };

    default:
      return { kind: 'answer', text: "I'm not sure what to do with that." };
  }
}
