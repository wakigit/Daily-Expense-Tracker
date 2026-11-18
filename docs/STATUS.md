# TallyAI status

Rewrite "Last session" at the end of every session (CLAUDE.md, Handover protocol). If this file and git disagree, git wins.

## Live state (as of 2026-11-17)
- main = wallpaper-redesign = ff83bd8: docs-only commit on top of 88bd48d, which shipped the P2 weekday fix.
- gh-pages = ad40e1a: Pages build of 88bd48d. .nojekyll present.
- Vercel Production: ailodge-expensetracker-eow5ec65t-wei-kai.vercel.app (ff83bd8). Serves the same bundle as the verified 88bd48d build (12/12 polls, 17 Nov).
- Rollback target to undo the P2 fix: ailodge-expensetracker-r9vueizjw-wei-kai.vercel.app (eaab1a5), content verified 17 Nov. Vercel Deployment Retention is on, so it may be deleted later; fallback is the source rollback in CLAUDE.md.
- Never promote irrj2lx0i (6cf9345): it rolls back two releases.
- Gate doc 11b §7 names mo5924pc4 as current Production; that stopped being true when ff83bd8 deployed. Rollback target unaffected.
- Working branch: dev (created from ff83bd8 on 18 Nov), at 086d820 then this commit. Not pushed. main/wallpaper-redesign/gh-pages are untouched since 17 Nov.

## Last session (2026-11-18)
- Context setup, on the new dev branch, docs and .gitignore only: created CLAUDE.md (read first, imports this file), this file and docs/SESSION-LOG.md; .gitignore now covers CLAUDE.local.md; RESUME, ROADMAP and CLAUDE-CODE-PROMPTS carry a "Historical" line at the top. Commits 086d820 and this one. Nothing pushed.
- Four facts in the supplied draft were corrected against the repo: dev was created 18 Nov not 17; index.html also carries a theme-color meta tag; this session's log line is 18 Nov; ASSISTANT-UPGRADE-PLAN.md is Stages 1-4 plus the Step3/Step4 designs with no Step 5 or Step 6 section, so it is not "the 6-step Ask plan".
- Full gate run because .gitignore is not a .md file: build pass, smoke 2408/2408, backend 239/239, self-check, fixture-checks and harness-checks pass, eval:main:mock 70/76 questions and 76/82 turns with no per-question change, git diff --check clean.
- Read-only .claude/ audit done (7 skills + 1 agent, 10 MB, gitignored, nothing deleted or moved). Recommended remove: design (live image-API client that reads .env into the environment), ui-styling (shadcn_add.py runs npx shadcn add in the repo root, which installs packages and writes components), banner-design (no deliverable needs it), frontend-developer agent (multi-framework app builder, against "no UI redesign unless approved"). Recommended keep: brand, slides, design-system, ui-ux-pro-max (reference text and local-only scripts).
- Previous session (2026-11-17): published the P2 weekday fix via gate 11b A-F, candidate 88bd48d; privacy check on all 10 commits passed before any push; Step G-lite on live Pages spent 2 paid calls, both exact ("Which weekday do I spend most on?" -> Saturday S$87.70; Public Transport this month -> S$14.30); no rollback trigger. See docs/SESSION-LOG.md and gate 11b §§7-8.

## Next steps (in order)
1. Wei Kai writes his one-paragraph interview description of Steps 3-4 (honest wording in CLAUDE.md). Not a Claude Code task.
2. Step 6, slimmed: re-record stale MAIN intents live (incl. M66/M67/M76, which hold stale 502 recordings, and all pre-Step-3 recorded intents), full MAIN run, HOLDOUT run exactly once (whatever it scores is the number, no fix-and-rerun), write docs/ASK-EVALUATION.md. Why: the MAIN mock replays recorded intents, so it cannot see changes in what the model now emits; that is how the P2 regression slipped through.
3. Groundwork: data export/import (JSON and CSV), a router, a PWA manifest (none is tracked; index.html only has Apple meta tags and a theme-color).
4. Landing page and first-run welcome flow, designed before building.
5. Accounts and a cloud database: not decided, see Open decisions.

## Open decisions
- Accounts: the reason (sync for real users / learning backend / looking complete), the stack (Supabase vs Neon + own API + auth library), whether guests keep AI Ask, whether a paid database plan is acceptable.
- Design scope: Apple-style landing page only (recommended) vs restyling the app.
- .claude/ third-party skills and agent: keep or remove (see the context-setup audit).
- Step 5 (trends, averages, top-N, what-if, savings goal): dropped unless an interviewer needs it.
- Step 4C plan confirmation: designed, parked until real users have used the live version; open risk §8.1 (nothing stops approving a plan without reading it).

## Known gaps (carry into ASK-EVALUATION.md; do not fix now)
- MAIN failures: M46, M48.2, M65, M66, M67, M76 (M66/M67/M76 stale 502 recordings; M67 has a harness numeric oracle that passes).
- Plan 4096-token ceiling configured, never measured.
- No screen-reader or physical-device audit.
- Plan feature depends on exact recognizer/model field agreement.
- A scalar category the user never named can still narrow (disclosed as "Counting only: ..."); see docs/ASSISTANT-SCALAR-CATEGORY-GUARD.md.
- Weekday question: about 1 in 5 live samples still falls back (model puts "weekday" in category_terms, 502, labelled offline answer).
- Unverified: the G-lite driver aborted an /assistant/roast request on page load. Check whether every visit with data triggers a paid roast call.

## Paid-call labels already used (scripts/eval/calls.log)
1, 2, 3A, 3A-close, 3B1, 3B2, 3B2-repair, 4-accept, 4-repair, 4c-design, 4c-open-9.1, publish-G, publish-G2, publish-G3, publish-gate. Pick a new label for every live check.
