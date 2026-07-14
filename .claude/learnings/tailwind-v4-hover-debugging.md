# Tailwind v4 hover/variant debugging notes

From debugging "hover animations not working" (which turned out to be fine):

- TW4 gates `hover:` AND `group-hover:` variants behind `@media (hover: hover)` —
  they emit as nested rules: `.hover\:x { &:hover { @media (hover: hover) { ... } } }`
- `scale-105` sets the CSS **`scale` property**, not `transform` — check
  `getComputedStyle(el).scale`, not `.transform`, when verifying
- CSSOM walking is misleading: the outer rule's `style.cssText` is empty (declarations
  live in nested rules); use `rule.cssText` (includes nesting) instead
- Headless-Chrome verification recipe: `chrome-devtools hover <uid>` then
  `evaluate_script` reading computed styles — `el.matches(':hover')` confirms the
  hover state took
- A11y snapshots show opacity-0 elements, and clicks work on them — snapshot/click
  success does NOT prove a hover-reveal animation works; only computed styles or a
  mid-hover screenshot do
- Distinguish card types before debugging: bento featured cards and creator cards
  intentionally have no hover action buttons; only grid vcards reveal download/heart
