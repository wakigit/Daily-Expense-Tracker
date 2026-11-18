# TallyAI: instructions for Claude Code

Read this file before doing anything. The current state of the project is in docs/STATUS.md, imported at the bottom. If STATUS.md and git disagree, git wins: say so in your report and correct STATUS.md.

## The project
- TallyAI is an expense tracker for students. Solo project by Wei Kai (Waki), first-year SMU Information Systems student. Built for the SMU BIA AI Lodge hackathon (submitted 18 Oct 2026), now used in internship interviews. Explain technical points in plain language in reports.
- Frontend: React + Vite in src/. Backend logic in backend/src. Vercel Functions in api/ reuse backend/src/routes.js. OpenAI Responses API, model gpt-4.1-mini, API key on the server only.
- All user data lives in browser localStorage under ww_* keys, behind src/lib/storage.js. No accounts, no server-side storage.
- Live: Vercel https://ailodge-expensetracker.vercel.app (frontend + /api). GitHub Pages https://wakigit.github.io/Daily-Expense-Tracker/ (frontend, calls the Vercel /api). Real users' data lives in their browsers on the Pages origin.
- Other features: grounded, output-validated roast; receipt scanning (always a reviewed draft, never a saved row); local ChromaDB prototype in tools/chroma-demo (hackathon judging requirement); CORS allowlist (default https://wakigit.github.io, CORS_ORIGINS override); per-IP rate limits 20/6/10; reduced motion respected.

## Ask architecture (never break)
The model only turns a question into a validated structured query, a clarification, help, a reviewable spending-scope proposal, or a bounded plan. App code filters, calculates in integer cents and shows evidence rows. The model never states a number. Strict shared validation (src/lib) runs on server and client. Unsupported or invalid means clarify, never guess, never silently drop a filter. Ledger descriptions are untrusted data.

Public description of multi-part questions (use this wording; no success rate; never "reliable"): "answers multi-part questions when it can match the request exactly, and refuses the whole request otherwise."

## How we work
- Wei Kai plans in a separate Claude chat that writes your prompts and checks your reports against git. Do what the prompt asks. If something looks wrong, stop and say so instead of improvising.
- Mock gates can be green while live behaviour breaks. Always say what a test cannot see.
- Measure before believing. Earlier sessions stated inferences as findings and were wrong twice. Bisect or measure first.
- Ask before tuning: an expectation may change only for a documented capability reason, never to raise a score.
- Pre-written expectations must cover every field the answer shows, not only the headline figure.
- If a prompt reaches you with an unreplaced placeholder like <PASTE ...>, STOP and ask.

## Standing rules for every task
(Written by Wei Kai; "I" and "me" mean him.)
- Never push, merge or deploy unless I reply "go". Never force-push, rebase or squash shared branches.
- Never print API keys or .env contents; never put OPENAI_API_KEY in VITE_ vars; never commit .env.
- Never clear or silently migrate GitHub Pages users' localStorage; storage keys must stay unchanged unless explicitly planned.
- Fictional data only for tests; regression tests use new data, not the eval fixture; never special-case test wording; never loosen validation to pass a test; never tune to HOLDOUT; HOLDOUT runs once in Step 6 only.
- No new dependencies, no model change, no UI redesign unless approved.
- Every commit: npm run build, npm run smoke, cd backend && npm test (+ provider tests), eval:self-check, eval:fixture-checks, eval:harness-checks (includes server-leg replay of captured plans), eval:main:mock (no per-question change unless explained), git diff --check. One logical change per commit.
- Paid calls: explicit cap per task, retries 0, never repeated for a better result, logged in scripts/eval/calls.log; expectations hand-written before calls.
- Start/stop only servers it started. Screenshots outside the repo. Live browser checks in a fresh Playwright context, never my real Chrome profile.
- Reports must label every claim ran / inferred / unverified, and end with STOP.
- Give hard time boxes ("hard stop N min; if unfinished, commit what's safe and report partial") and cap subagents (max 3 without asking). It overran soft time boxes ~2x repeatedly.

Additions (17 Nov 2026):
- Docs-only exception: a commit that changes only .md files needs only git diff --check. Any other file, including scripts/eval/calls.log, runs the full gate.
- Treat every time box in a prompt as hard.
- Every paid live check gets a new, unique step= label. Check calls.log before choosing one.
- Never stage media, screenshots or receipts. Media lives outside the repo in ../TallyAI-media.

## Branches and deploys
- main is Production on Vercel. Every push to main redeploys Production, even a docs-only commit. wallpaper-redesign mirrors main.
- Routine work happens on the dev branch. main and wallpaper-redesign move only in a gated publish, fast-forward only.
- GitHub Pages serves the gh-pages branch: build with the Pages env vars, publish with rsync --exclude .git --exclude .nojekyll, normal push. Never delete .nojekyll.
- Every publish follows a written gate doc (latest: docs/PUBLISH-GATE-2026-11-11b.md) and needs an explicit "go" that names a rollback target.
- Rollback rule: roll back ONLY on a wrong figure, a silently dropped filter, or a crash/500. A clarification on a supported question is the known limit, not a trigger. Never roll back without Wei Kai's instruction. Fastest: promote the recorded deployment in Vercel. Source: git revert --no-commit <last good>..<shipped tip>, then one commit, never force-push. Pages: revert commit on gh-pages from the current remote tip.
- Never move or rename the repo folder.

## Doc map
- Current: docs/STATUS.md (state, next steps), docs/SESSION-LOG.md (one line per session), docs/PRD.md (product and limits; its hosting sections predate Vercel), docs/ASSISTANT-UPGRADE-PLAN.md (the Ask upgrade plan: Stages 1-4 and the Step3/Step4 designs; no Step 5 or Step 6 section), the latest gate doc, docs/ASSISTANT-SCALAR-CATEGORY-GUARD.md (a documented gap).
- Historical, do not plan from: docs/ROADMAP.md, docs/RESUME.md, docs/CLAUDE-CODE-PROMPTS.md.

## Handover protocol: before every STOP
1. Rewrite the "Last session" section of docs/STATUS.md: date, what changed, commits, anything half-done. Update "Live state", "Next steps" and "Open decisions" if they changed. Keep STATUS.md under 90 lines; history goes in the session log.
2. Append one line to docs/SESSION-LOG.md: date | task | result | commits.
3. If the task has its own doc (gate, design, evaluation), update it too.
4. Commit as a separate "docs: status" commit on the current branch. Do not push unless the prompt says so.
5. Never write keys, .env contents or personal details beyond what README.md already shows into these files. This repo is public.

@docs/STATUS.md
