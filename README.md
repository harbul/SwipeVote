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

---

## Architecture

Two-package monorepo. **Backend** is a Node + Express server on `:3001` with a SQLite database (`better-sqlite3`). It exposes five endpoints: `GET /api/items`, `POST /api/vote`, `DELETE /api/vote` (undo), `GET /api/results`, `GET /api/votes/:sessionId`. **Frontend** is a React + Vite app on `:5173` (proxying `/api` to the backend) with **Framer Motion** for the swipe physics and **Fraunces + Manrope + Newsreader** for an editorial typographic voice.

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

## Known issues / what we'd do with more time

- **Image preloading:** the next two cards are lazy-loaded; in flaky network conditions there can be a beat of empty image before they pop in. We'd add a tiny in-app blurhash or skeleton on the image wrapper.
- **No accessibility audit beyond ARIA labels** on buttons. Keyboard swipe (← / →) would be a low-cost addition.
- **No tests.** With 2 hours we focused on shipping. Vote endpoint validation + idempotency would be the natural first integration tests.
- **No persistence of which sort the user picked on Results** — it resets to "Most Loved" each visit. Storing in localStorage would be one line.

---

## Credits

- Imagery: **[Dog CEO API](https://dog.ceo/api)** (free, no key, ~120 breeds).
- Typography: **Fraunces** by Phaedra Charles & Flavia Zimbardi, **Manrope** by Mikhail Sharanda, **Newsreader** by Production Type, **JetBrains Mono** by JetBrains — all via Google Fonts.

See [AI_NOTES.md](AI_NOTES.md) for the AI-usage write-up.
