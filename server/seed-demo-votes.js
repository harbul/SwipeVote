/**
 * Demo-vote seed. Populates the votes table with realistic-looking
 * activity from 8 simulated voters so:
 *
 *   - Results view has rich content across all three sort modes.
 *   - The current (real) user only needs to swipe yes on a few of the
 *     first ~30 breeds for the Matches view to populate.
 *   - /api/stats returns a credible totalVotes / sessions / avgDecisionMs.
 *
 * Idempotent: drops any existing 'demo-voter-*' rows before reseeding,
 * so re-running just refreshes the dataset. Real user votes are untouched.
 *
 * Usage:  cd server && node seed-demo-votes.js
 */
import { db, statements } from './db.js';

const SESSIONS = Array.from({ length: 8 }, (_, i) =>
  `demo-voter-${String.fromCharCode(97 + i)}`
);

// Tiers are assigned to item IDs in order, so the popular tier sits at
// the FRONT of the deck — the user is likely to swipe yes on a few of
// them during the demo, which is what populates the Matches view.
const TIERS = [
  { label: 'popular',     fromId: 1,  toId: 30, yes: 5, no: 1 },  // ~83% yes-rate
  { label: 'divisive',    fromId: 31, toId: 50, yes: 3, no: 3 },  // 50% yes-rate
  { label: 'leaning-no',  fromId: 51, toId: 70, yes: 2, no: 3 },  // 40% yes-rate
  { label: 'skipped',     fromId: 71, toId: 80, yes: 0, no: 1 },  // 0% yes-rate, low volume
  // IDs 81–100 are intentionally untouched so "Most Skipped" has zero-vote items too.
];

function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Realistic decision time: most votes 1.5–8s, occasional 10–18s outlier.
function randomDecisionMs() {
  const base = 1500 + Math.random() * 6500;
  const longTail = Math.random() < 0.12 ? Math.random() * 8000 : 0;
  return Math.round(base + longTail);
}

const cleared = db
  .prepare(`DELETE FROM votes WHERE session_id LIKE 'demo-voter-%'`)
  .run().changes;
console.log(`Cleared ${cleared} prior demo-voter rows.`);

const totalItems = db.prepare(`SELECT COUNT(*) AS n FROM items`).get().n;
if (totalItems < 80) {
  console.error(`Need at least 80 items in the catalog (have ${totalItems}). Run \`node seed.js\` first.`);
  process.exit(1);
}

const apply = db.transaction(() => {
  for (const tier of TIERS) {
    for (let id = tier.fromId; id <= tier.toId; id++) {
      const voters = shuffle(SESSIONS);
      let v = 0;
      for (let i = 0; i < tier.yes; i++) {
        statements.upsertVote.run({
          sessionId: voters[v++],
          itemId: id,
          choice: 'yes',
          decisionMs: randomDecisionMs(),
        });
      }
      for (let i = 0; i < tier.no; i++) {
        statements.upsertVote.run({
          sessionId: voters[v++],
          itemId: id,
          choice: 'no',
          decisionMs: randomDecisionMs(),
        });
      }
    }
  }
});
apply();

const totals = db
  .prepare(`SELECT COUNT(*) AS votes, COUNT(DISTINCT session_id) AS sessions FROM votes`)
  .get();
const avgMs = db
  .prepare(`SELECT AVG(decision_ms) AS avg FROM votes WHERE decision_ms IS NOT NULL`)
  .get().avg;

console.log(`\nDone. Votes table now: ${totals.votes} votes from ${totals.sessions} sessions, avg ${Math.round(avgMs)}ms decision.`);

const top = db.prepare(`
  SELECT i.label,
         SUM(CASE WHEN v.choice='yes' THEN 1 ELSE 0 END) AS yes,
         COUNT(*) AS total
  FROM items i JOIN votes v ON v.item_id = i.id
  GROUP BY i.id
  HAVING total >= 2
  ORDER BY (yes * 1.0 / total) DESC, total DESC
  LIMIT 5
`).all();
console.log('\nTop 5 by yes-rate (any of these → Match if the user swipes yes):');
top.forEach(r =>
  console.log(`  ${r.label.padEnd(30)} ${r.yes}/${r.total} (${Math.round((r.yes / r.total) * 100)}%)`)
);
