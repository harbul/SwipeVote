# SwipeVote — A Curated Dog Adoption Edit

Mobile-first swipe-to-vote web app. Users swipe through **100 distinct dog breeds**, vote **Adopt** (right) or **Pass** (left), and see how the entire crowd has voted — sorted by *Most Loved*, *Most Divisive*, or *Most Skipped*. Built for CMPE 285 final exam.

> **Theme:** Dog breeds. Images sourced from the free [Dog CEO API](https://dog.ceo/api). Each breed has an image, a breed name, and a short tagline.

---

## Run it

You need Node 18+ (for native `fetch`). Two terminals:

```bash
# Terminal 1 — backend
cd server
npm install
node seed.js --reset       # fetches 100 breeds (~10s) and writes data/swipevote.db
node server.js             # http://localhost:3001

# Terminal 2 — frontend
cd client
npm install
npm run dev                # http://localhost:5173
```

Open **http://localhost:5173** in a mobile-emulated Chrome window (390 × 844). Swipe, vote, switch tabs.

To **re-seed** with a fresh image set: `cd server && node seed.js --reset` (this also clears votes).

For a **demo with realistic crowd data**, run the demo-vote seed after the main seed:

```bash
cd server && node seed-demo-votes.js
```

This creates 8 simulated voters (`demo-voter-a` through `demo-voter-h`) with overlapping preferences — popular breeds at the front of the deck (~83% yes-rate), divisive breeds in the middle, and a long tail. After running it, swiping yes on any of the first ~30 breeds will populate the Matches view immediately. Re-running is safe: it drops the previous `demo-voter-*` rows and reinserts. Real user sessions are untouched.

---

## Architecture

Two-package monorepo. **Backend** is a Node + Express server on `:3001` with a SQLite database (`better-sqlite3`) exposing a small REST surface — items list, vote upsert, vote undo, aggregate results, per-session votes, live stats, and a key-gated admin endpoint for adding items (full table under [API contract](#api-contract) below). **Frontend** is a React + Vite app on `:5173` (proxying `/api` to the backend) with **Framer Motion** for the swipe physics and **Fraunces + Manrope + Newsreader** for an editorial typographic voice.

The user's identity is an anonymous **UUID v4** stored in `localStorage`, sent with every vote. **Idempotency** is enforced at the DB layer: `UNIQUE(session_id, item_id)` plus `INSERT … ON CONFLICT DO UPDATE` — re-voting the same item replaces, never duplicates. The deck filter on the client (`allItems.filter(it => !voted.has(it.id))`) skips already-voted items, so reloading mid-deck resumes where you left off.

### Project layout

```
SwipeVote/
├── server/
│   ├── server.js              # Express + routes + validation
│   ├── db.js                  # SQLite schema + prepared statements
│   ├── seed.js                # fetches 100 breeds → image_url
│   └── data/swipevote.db      # generated at runtime
└── client/
    ├── vite.config.js         # /api proxy → :3001
    ├── index.html             # Google Fonts: Fraunces, Manrope, Newsreader, JetBrains Mono
    └── src/
        ├── App.jsx            # view router: deck | results | matches
        ├── api.js             # fetch wrappers
        ├── session.js         # getOrCreateSessionId()
        ├── styles.css         # design tokens + all styles
        └── components/
            ├── SwipeDeck.jsx
            ├── SwipeCard.jsx
            ├── Results.jsx
            ├── Matches.jsx
            ├── EndOfDeck.jsx
            └── TabBar.jsx
```

---

## Design direction — *"Editorial Pet Salon"*

We resisted the default "AI-purple-gradient on white" trap. The visual direction is **warm cream paper + ink black + juicy tangerine + deep forest** — closer to a curated print magazine than a CRUD dashboard.

- **Typography:** Fraunces (variable serif with `SOFT` + `WONK` axes) for display, Newsreader italic for accent body, Manrope for UI, JetBrains Mono for tabular figures.
- **Detail:** dashed inner card rule (trading-card energy), `Edition №NNN` chip, SVG-noise grain on the cream background, warm-tinted (not gray) shadows, italicized last word of every breed name in tangerine.
- **Motion:** Framer Motion drag with elastic rebound; tilt + tint + ADOPT/PASS rubber-stamps during drag; segmented sort selector with a sliding ink pill; tab bar with a `layoutId`-shared pill animation.

---

## Requirements checklist

### Core (must have)
| | Requirement | Notes |
|---|---|---|
| ✅ | Pick a theme | Dog breeds, documented above |
| ✅ | 100+ items with image + label/description | 100 breeds seeded from Dog CEO API |
| ✅ | Swipe-card UI | Framer Motion drag with tilt, tint, stamps, snap-back |
| ✅ | Yes/No buttons | Tangerine adopt button + ink pass button + ghost undo |
| ✅ | Visual feedback during gesture | Green/red tint, ADOPT/PASS rubber stamps, rotation |
| ✅ | Smooth card transition | Spring-physics exit, ref-driven so buttons and drag share the same animation |
| ✅ | Results view, reachable from nav **and** by downward swipe | Bottom tab bar + EndOfDeck CTA + pull-down gesture on the active card (`dy > 110px`) |
| ✅ | Aggregate yes/no counts | Live via 5s polling |
| ✅ | At least one sort | **Three**: Most Loved, Most Divisive, Most Skipped (animated segmented control, hero cover changes per sort) |
| ✅ | Server-backed persistence (not localStorage as source of truth) | SQLite via `better-sqlite3` |
| ✅ | End-of-deck state | Editorial "Issue Complete" card with `Open Results →` CTA |

### Stretch (all six implemented)
| | Stretch | Notes |
|---|---|---|
| ✅ | Anonymous session ID | UUID v4 via `crypto.randomUUID()` in localStorage |
| ✅ | Undo last swipe | Keeps history of last 10 votes; `DELETE /api/vote` on the server |
| ✅ | Matches view | Items where the user voted yes **and** global yes-rate ≥ 60% (with ≥ 2 votes) |
| ✅ | Real-time updating | 5-second polling on the Results view |
| ✅ | Admin / seed script to add items without code changes | `node seed.js --reset` + `POST /api/items` with `X-Admin-Key` header (default `swipe-admin`, override via `ADMIN_KEY` env) |
| ✅ | Basic analytics | `GET /api/stats` returns `{ totalVotes, sessions, avgDecisionMs }`; surfaced in the Results masthead byline (e.g. *"66 votes · 2 voters · 8.0s avg decision · refreshing every 5s"*). Decision time is captured client-side from when a card becomes the active top card to when its vote fires. |

---

## Trade-offs made under time pressure

- **SQLite over Postgres/Mongo.** Zero-config, fits in one file, sync API via `better-sqlite3` means simpler request handlers and no connection pooling. With < 100k votes it'll be fast enough indefinitely.
- **REST over WebSockets** for live results. The grading rubric accepts polling; 5s polling delivers the live-feeling experience with one line of code.
- **No Tailwind, no UI kit.** A single hand-tuned `styles.css` lets us commit to the bespoke editorial aesthetic without fighting framework defaults — and avoids the 50KB+ Tailwind preflight on a 100-item app.
- **Optimistic UI.** Votes are reflected locally the moment the card animates out; the POST happens in the background. A failed POST rolls back the local state and logs to the console.
- **In-component CSS variables.** All design tokens live in `:root` of `styles.css` — no theme provider, no styled-components, no class-name engine. Mobile-first means we have one breakpoint to worry about and no reason to abstract.
- **Card aspect-ratio with a hard cap.** The swipe card uses `aspect-ratio: 3/4.2` so it looks the same proportions on every mobile screen, but `.deck__stage` also has `max-height: calc(100svh - 310px)` so on shorter or wider viewports the height stops growing before it can push the action row down into the fixed tab bar. Using `svh` (small viewport height) means the cap holds even as the iOS Safari URL bar appears and disappears.

---

## API contract

| Method | Path | Body / Params | Returns |
|---|---|---|---|
| `GET`    | `/api/items`             | — | `[{ id, label, description, image_url }]` |
| `POST`   | `/api/items`             | header `X-Admin-Key: swipe-admin`, body `{ label, description?, image_url }` | `201 { ok: true, id }` |
| `POST`   | `/api/vote`              | `{ itemId, choice, sessionId, decisionMs? }` | `{ ok: true }` (upsert) |
| `DELETE` | `/api/vote`              | `{ itemId, sessionId }` | `{ ok: true }` |
| `GET`    | `/api/results`           | — | `[{ itemId, label, image_url, yes, no, total, yes_rate }]` |
| `GET`    | `/api/stats`             | — | `{ totalVotes, sessions, avgDecisionMs }` |
| `GET`    | `/api/votes/:sessionId`  | — | `[{ itemId, choice }]` |
| `GET`    | `/api/health`            | — | `{ ok: true }` |

Validation: `itemId` must be an integer that exists; `choice` ∈ `{'yes','no'}`; `sessionId` must be a non-empty string ≤ 64 chars. Bad input returns `400` with `{ error }`.

---

## Status

All Core (§3.1) and Stretch (§3.2) requirements implemented and verified end-to-end against a fresh clone — see the requirements checklist above. The happy path has no console errors and no known bugs at submission time.

---

## Future scope

If this were a longer-running product, the next things on the roadmap would be:

- **Lightweight sign-in** — a username-only or email-magic-link layer on top of the existing anonymous session so users can carry their votes across devices and see "voted by @harshita" credits in the Results view.
- **WebSocket-driven live results** — replace the 5-second polling on `/api/results` with a Socket.io stream so the byline and grid update the instant any voter swipes. The polling fallback would stay for clients that can't hold a socket open.
- **Categories and filters in the swipe deck** — let the user narrow the deck to e.g. *small breeds*, *terriers*, *hypoallergenic* before they start swiping. Backend support is a single `WHERE category = ?` clause on `/api/items`.
- **"Your edition" share card** — a one-tap export of the user's top matches as a styled PNG (same Fraunces + tangerine treatment) so they can post their dog taste to Instagram. Generated server-side via `@vercel/og` or similar.
- **Per-breed detail page** — tap any tile or card to open a full breed page with the global yes/no histogram, a few representative voter comments, and a "see this breed on Petfinder" outbound link.
- **Real adoption integration** — the natural extension. Plug the Petfinder / ASPCA APIs in, surface actually-adoptable dogs in the user's zip code, and turn yes-votes into save-to-watchlist actions.
- **Admin expansion** — edit and delete items, bulk-import a CSV, view per-item vote provenance, ban a session id, regenerate the seed.
- **Accessibility pass** — keyboard navigation (← / → / `↩`), full ARIA on the segmented sort, a high-contrast mode that preserves the editorial direction.
- **Internationalization** — Fraunces + Manrope + Newsreader all ship strong Latin-Extended coverage; the byline copy, kicker tags, and end-of-deck message would be the main translation surface.
- **Integration test suite** — vitest for the React components, supertest for the Express routes. The vote-idempotency case would be the first one written.

---

## Credits

- Imagery: **[Dog CEO API](https://dog.ceo/api)** (free, no key, ~120 breeds).
- Typography: **Fraunces** by Phaedra Charles & Flavia Zimbardi, **Manrope** by Mikhail Sharanda, **Newsreader** by Production Type, **JetBrains Mono** by JetBrains — all via Google Fonts.

See [AI_NOTES.md](AI_NOTES.md) for the AI-usage write-up.
