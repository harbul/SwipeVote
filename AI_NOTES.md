# AI Usage Write-up

This project was built end-to-end in a single ~2-hour session as an explicit AI-pair-programming exercise. The collaborator was **Claude (claude-opus-4-7)** running inside Claude Code, driving Bash/Read/Edit/Write tools and a browser preview MCP.

---

## What Claude wrote end-to-end

- The entire **backend** — `server/db.js` (schema, prepared statements, idempotent upsert pattern), `server/server.js` (routes, validation, CORS), and `server/seed.js` (Dog CEO breed-list flatten + shuffled 100-item fetch in batches of 20).
- The entire **frontend** — design tokens in `styles.css`, the `SwipeCard` drag/tilt/tint/stamp logic with Framer Motion, the `SwipeDeck` ref-driven exit choreography, the sortable magazine-spread `Results` view (hero cover + contact-sheet grid with decorative rank numerals), the `Matches` filter, the `EndOfDeck` editorial card, and the `TabBar` with `layoutId`-shared pill.
- The **closing pass** that brought stretch coverage to 6/6: a downward-pull gesture on the active card (re-using the same drag handler), a `votes.decision_ms` column added via `ALTER TABLE` (forward-compat with existing DBs), a new `/api/stats` endpoint computing `{ totalVotes, sessions, avgDecisionMs }`, an admin `POST /api/items` behind an `X-Admin-Key` header, and a richer Results masthead byline that surfaces all three analytics figures in one italic line.
- The **design direction**. I gave Claude the constraints (mobile-first, playful-premium, no AI-purple-gradient slop) and it committed to *"Editorial Pet Salon"* — warm cream paper, ink black, tangerine, deep forest, Fraunces + Manrope + Newsreader. The trading-card dashed inner rule, `Edition №NNN` chip, italicized-last-word-in-tangerine pattern, and the SVG-noise grain texture were all Claude's calls.
- This README, the architecture description, and the trade-offs section.

I provided product direction (theme, stack, stretch features, "make it feel premium"), reviewed every file before it was written, and steered fixes when behavior didn't match intent.

---

## Four concrete places I had to push back

**1. AnimatePresence and the stale exit cards.** Claude's first pass wrapped the swipe deck in `<AnimatePresence>` and used the SwipeCard's local `exit` state to drive an exit animation via the `animate` prop. The visible UI looked correct, but `document.querySelectorAll('.card')` in the preview console showed **7 cards in the DOM after 4 votes** — exited cards were being kept mounted with `opacity: 0` and `translateX(-520px)` because they had no `exit` prop for AnimatePresence to drive, so it never unmounted them.

The fix was a deliberate refactor: drop AnimatePresence entirely, give the SwipeCard a `useImperativeHandle` ref exposing `triggerVote(choice)`, and have the parent's buttons call into the active card via that ref. The card runs its own exit animation, and an `onAnimationComplete` callback notifies the parent — *then* the parent updates `voted` and the card unmounts naturally with no leftover DOM. Card count post-fix: exactly 3 (top + 2 in the back stack), as designed.

I caught this by inspecting the DOM with the preview MCP — not by reading the code. The lesson: visual correctness is not the same as DOM correctness, and Claude's first attempt at framer-motion exits was a "looks right, isn't right" trap.

**2. Mid-build redirect: "make the Results page feel like a magazine."** Claude's first Results view was correct but generic — a uniform list of rows with thumb, name, percentage, bar. I re-invoked the `frontend-design` skill mid-build and asked for a magazine-spread instead: hero cover on top, contact-sheet grid below. Claude's first response committed to a clean conceptual direction (huge Fraunces italic rank numerals as decorative typography, sort-aware kicker tags BEST/DIVIDED/SKIPPED, a `layout`-prop spring re-flow when the sort changes). I pushed back on two execution details: (a) the tile rank numerals were set to `top: -22px` and got their top half visually amputated — I had to dial it to `-4px` with a smaller font size so the digits actually read; (b) the hero kicker tag was generated with `kicker.split(' ')[0]`, which produces "BEST" from "BEST IN SHOW" but degenerates to "THE" from "THE GREAT DEBATE". I had to introduce an explicit `HERO_TAG` lookup map. Both bugs Claude introduced by being clever; both fixes were obvious once I named them.

**3. preview_click vs React's synthetic event system.** When I had Claude test the swipe buttons via the browser-preview MCP, `preview_click('.btn--yes')` reported success but no vote was firing on the server. Claude's first instinct was to investigate the obvious causes — pointer-events, z-index, an obscuring overlay, the AnimatePresence stale cards. We burned ~3 minutes of round-trips before I prompted Claude to call the React fiber's `__reactProps$.onClick()` directly via `preview_eval`, which worked instantly. The actual problem: `preview_click` dispatches a native click event that React's synthetic event delegation silently ignores. The takeaway for Claude: when a tool's behavior diverges from your mental model, lean on lower-level inspection (read the fiber, eval JS) faster — don't keep investigating "downstream" symptoms.

**4. The card-overlapping-tab-bar bug Claude verified itself wrong on.** Claude tested the swipe deck at 390×844 (iPhone 13 emulation), inspected the geometry programmatically (`actions.bottom`, `tabbar.top`), confirmed a 56px gap, and declared the layout fine. Hours later I pasted a real screenshot showing the heart/undo/✕ button row clearly clipped behind the fixed bottom tab bar — because in actual use I was at a wider/shorter viewport where the card's `aspect-ratio: 3/4.2` pushed the action row down into the tab bar's overlap zone. Claude's verification logic was correct *for the viewport it tested* but failed to consider that the card height is viewport-relative and would behave differently elsewhere. The fix was small (`.deck__stage { max-height: calc(100svh - 310px) }` + bump `.app` padding-bottom + `min-height: 0` on the flex column), but the lesson is bigger: a single-viewport verification is not the same as a layout that holds. I should have eyeballed the screenshot myself, not just trusted Claude's bounding-box math.

---

## One thing Claude did *better* than I expected

The **design tokens and the editorial visual direction**. I gave a short brief ("playful but premium, no purple gradients") and the `frontend-design` skill came back with a fully realized aesthetic that I would not have come up with cold: warm-tinted shadows (not cool gray), `font-variation-settings: 'SOFT' 60, 'WONK' 1` on Fraunces to get characterful italics, italicizing only the *last word* of each breed name in tangerine for a magazine-headline feel, and the dashed inner card rule (`outline: 1px dashed; outline-offset: -10px`) that makes every card read like a Top Trumps trading card without me having to ask. I wouldn't have thought of any of those individually. Stitching them into one cohesive look in 15 minutes was the single biggest time-save.

---

## One thing Claude did *worse* than I expected

**Click events through the preview MCP.** Claude assumed `preview_click` would behave like a real user click. It doesn't — it dispatches a synthetic event that React's synthetic event system silently ignores. Claude wasted three minutes screenshotting and re-screenshotting after `preview_click` calls and concluding "the click is reaching the DOM but the React handler isn't firing" before I (the human) prompted Claude to call `__reactProps$.onClick()` directly via `preview_eval`, which worked instantly. Claude should have skipped to invoking the React fiber handler on the first sign of trouble; instead it spent time investigating overlays, pointer-events, z-index, and AnimatePresence before getting to the actual cause.

The takeaway: when a tool's behavior diverges from your mental model, lean on lower-level inspection (read the fiber, eval JS) faster.

---

## Other AI tools used

None. This was Claude (Opus 4.7, 1M context) end-to-end, with the `frontend-design` skill loaded as a sub-pass for the visual direction.
