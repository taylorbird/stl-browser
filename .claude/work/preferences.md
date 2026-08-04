# Candidate User Preferences (Unconfirmed)

This file holds **candidate** preference observations about the CURIO project owner (Taylor),
captured from working sessions. These are NOT confirmed standing rules — they are notes for
Taylor to review and either promote to real guidance or discard. Do not treat entries here as
authoritative instructions.

<!-- entries below, newest first -->

## 2026-07-16

- Communicates in very short, terse directives ("try again", "wrong app nvm", "so like i cant even see it now", "browserless is at http://..."). Expects the assistant to act and diagnose from minimal input rather than ask for elaboration. Tersely-reported symptoms ("the images didnt save", "why isnt it under recently added") seem to be an implicit request for root-cause investigation, not clarifying questions.
- When a feature "doesn't work," seems to value the assistant distinguishing what's verified at the backend/API level vs. what's a frontend/browser/stale-tab issue — i.e. proving where the problem actually is before proposing a fix. (This session: "images didn't save" turned out to be a real backend content-type bug; "can't see it now" was a changed model id / stale tab; "not under recently added" was a real filter-semantics bug.)
- Appears to prefer the assistant fixing his data directly rather than handing him steps: when asked how to handle an imageless model record ("The Rail v2"), he chose "Redo it for me" (delete + re-create via the API, verify) over doing it himself in the browser.
- Seems to prefer consolidating work onto one canonical repo: when importer work existed only as uncommitted changes on a separate OrbStack VM copy, he chose "bring it here" (into the Mac repo) rather than committing it on the VM.
- Cares that UI/UX semantics match user intuition: flagged that a model added that day wasn't showing under "Recently added," and given the option, chose to change the shelf to mean "when I added it" rather than "when it was published" — willing to take on a small schema change for the more intuitive behavior.
- Directs the mechanics of how the assistant does meta-work, not just the goal: specified this session's checkpoint be run "using a coordinated agent team (Workflow tool), with all agents running on the Sonnet model" — comfortable dictating parallelization and model choice. (Consistent with the 2026-07-14 observation below.)

## 2026-07-14

- Pushes back on infrastructure directives to understand the underlying reason before accepting them, rather than taking "it's required" at face value. Quote: "I'm running a local app here on Docker... I can open things just fine [in my browser]. Is there no way we can make this work in this setup?" — wanted the reason a headless browser could bypass Cloudflare bot-detection when a server fetch couldn't, explained before signing off on routing through browserless over Tailscale.
- When infrastructure he was pointed to (self-hosted browserless) turned out to be blocked by a network issue, didn't wait for it to be debugged — directly supplied an alternate working resource himself (an address plus auth token) mid-conversation. Suggests he's willing to hand over working alternatives rather than insisting the original path be fixed first.
- Explicitly asked for fail-fast, named-dependency error handling around an optional external service: "since some importers are going to require browserless, can we put some environment variables for a BROWSERLESS_URL? If it's not there, don't even give. Let's catch it." Wants missing preconditions caught immediately with a clear message naming the actual site/dependency, not a deep/generic failure — likely a recurring preference for future optional external-service integrations.
- After backend verification via curl/API tests, asked to get the app running locally so he could test the real flow himself in a browser, rather than stopping at "tests pass." Suggests a preference for hands-on, browser-level verification of UI-facing features even when backend tests already demonstrate correctness.
- Gave an explicit, specific instruction about HOW to run a multi-step maintenance task — checkpoint "using a coordinated agent team (Workflow tool), with all agents running on the Sonnet model" — not just what to do. Suggests comfort directing the mechanics of how Claude organizes its own work (parallelization, model choice), not just the end goal.
- States architecture pushback as a principle with the alternative already proposed, not just a veto — e.g. rejecting a global dependency in favor of an opt-in-per-component design. Quote: "I don't want to use browserless for an importer unless we have to so I'm thinking we need per-importer settings." Suggests a general preference for opt-in/blast-radius-limited defaults on new dependencies.
- For visually-scoped scraping/UI-matching ambiguity, prefers pinning scope down with an actual screenshot over a verbal description. Quote: "the images to the left of the hero are all I'm concerned with, in addition to the hero. Nothing more. Can we find a way to nail that down?" Worth defaulting to asking for (or taking) a screenshot when scope is visually ambiguous.
- Actively challenges technical inferences that sound plausible but aren't verified, rather than letting them pass — e.g. questioned an unverified claim about which dev machine a service was hosted on ("Aren't we on CCP right now?"), which surfaced a real distinction between two similarly-named hosts. Reinforces existing verify-before-stating expectations, especially for infra/network claims.
- Engages hands-on with infrastructure/network debugging in real time (DNS, Tailscale peer status, docker ps) rather than wanting it deferred, and takes ownership of the actual fix once root cause is found rather than asking for a code workaround.

## 2026-07-01

- Prefers a fast build -> show -> get-feedback loop for UI work over long upfront spec/brainstorming; get a visible change in the browser quickly. Quote: "I just work better seeing it so let's make a change. You show it to me and we'll go from there."
- Comfortable reorganizing code structure when it serves the goal; open to proposing structural refactors (e.g. a per-site importer directory structure). Quote: "If we need to organize the code that way, that's fine."
- Gives terse go-aheads ("yep", "yeah") and expects forward motion on the stated plan rather than re-confirmation.
