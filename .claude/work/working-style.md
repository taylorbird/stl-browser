# Working Style (confirmed feedback from Taylor)

Moved here 2026-09-23 from the old Mac's machine-local Claude memory so it survives the
machine move. Unlike preferences.md (unconfirmed candidates), these are rules Taylor stated
directly.

## Just run the named operation — don't probe configs
When Taylor says creds/config are already set up ("ssh creds are stored", "it's configured"),
run exactly the operation asked for (e.g. `git push`). Don't grep ~/.ssh/config, dotfiles, or
attempt logins to "verify" first. If it fails or is genuinely ambiguous, ask one direct question.
**Why:** 2026-06-04 — "what are you doing? just git push, its already configured stop searching
all my files."

## Implement directly when the plan already has complete code
For plans whose tasks include complete code listings, implement directly (tests + commit per
task, one consolidated review at the end). Reserve per-task subagent + review loops for
genuinely open-ended tasks, and offer the tradeoff rather than defaulting to the heaviest process.
**Why:** 2026-06-04 MANIFOLD redesign — Taylor stopped subagent-driven development after 2 of 14
tasks ("this seems to be taking awhile"); the review rounds had found zero required fixes.

## No chrome-devtools MCP for browser work
For browser automation or a logged-in session, use browserless or Claude in Chrome, or have
Taylor log in and read cookies from the browser store (e.g. gallery-dl
`--cookies-from-browser chrome`). Never silently substitute the chrome-devtools MCP.
**Why:** 2026-08-05 — "I don't want to use Chrome DevTools. I want to use other options,
browserless or preferably Chrome, claude for Chrome, etc."

## Deploy target
Docker images (`taylorlbird/curio-api`, `taylorlbird/curio-web`) run on a Raspberry Pi —
always build `--platform linux/arm64`. The Pi's compose mounts the NAS at
`/mnt/nas/projects/3dprint/models-new`.
