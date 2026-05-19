/**
 * Demo-vote seed. Populates the votes table with realistic activity from
 * 20 simulated voters so the Results and Matches views look lived-in.
 *
 * Distribution (by item id):
 *   1–30  popular     ~80% yes-rate, 12–16 votes per item
 *   31–55 divisive    ~50% yes-rate, 10–14 votes per item
 *   56–75 leaning-no  ~33% yes-rate, 8–12 votes per item
 *   76–90 skipped     0–2 total votes per item
 *   91–100 untouched  0 votes (so "Most Skipped" has zero-vote items too)
 *
 * Popular items sit at the FRONT of the deck so the real user, swiping
 * yes during a demo, lands matches almost immediately.
 *
 * Idempotent: drops 'demo-voter-*' rows first, real user sessions untouched.
 *
 * Usage:  cd server && node seed-demo-votes.js
 */
import { db, statements } from './db.js';

const VOTER_COUNT = 20;
const SESSIONS = Array.from(
  { length: VOTER_COUNT },
  (_, i) => `demo-voter-${String(i + 1).padStart(2, '0')}`
);

// Each tier specifies a range of item ids and a probability that
// any given voter (a) participates on that item, and (b) votes yes.
const TIERS = [
  { label: 'popular',     fromId: 1,  toId: 30,  participation: 0.75, yesProb: 0.82 },
  { label: 'divisive',    fromId: 31, toId: 55,  participation: 0.65, yesProb: 0.50 },
  { label: 'leaning-no',  fromId: 56, toId: 75,  participation: 0.55, yesProb: 0.33 },
  { label: 'skipped',     fromId: 76, toId: 90,  participation: 0.08, yesProb: 0.30 },
  // IDs 91–100 are untouched.
];

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
if (totalItems < 90) {
  console.error(`Need at least 90 items in the catalog (have ${totalItems}). Run \`node seed.js\` first.`);
  process.exit(1);
}

const apply = db.transaction(() => {
  for (const tier of TIERS) {
    for (let id = tier.fromId; id <= tier.toId; id++) {
      for (const sessionId of SESSIONS) {
        if (Math.random() > tier.participation) continue;
        const choice = Math.random() < tier.yesProb ? 'yes' : 'no';
        statements.upsertVote.run({
          sessionId,
          itemId: id,
          choice,
          decisionMs: randomDecisionMs(),
        });
      }
    }
  }
});
apply();

const stats = db
  .prepare(`SELECT COUNT(*) AS votes, COUNT(DISTINCT session_id) AS sessions FROM votes`)
  .get();
const avgMs = db
  .prepare(`SELECT AVG(decision_ms) AS avg FROM votes WHERE decision_ms IS NOT NULL`)
  .get().avg;

console.log(`\nDone. Votes table now: ${stats.votes} votes from ${stats.sessions} sessions, avg ${Math.round(avgMs)}ms decision.`);

const tierSummary = db.prepare(`
  SELECT i.label,
         SUM(CASE WHEN v.choice='yes' THEN 1 ELSE 0 END) AS yes,
         SUM(CASE WHEN v.choice='no'  THEN 1 ELSE 0 END) AS no,
         COUNT(*) AS total
  FROM items i JOIN votes v ON v.item_id = i.id
  GROUP BY i.id
  HAVING total >= 3
  ORDER BY (yes * 1.0 / total) DESC, total DESC
  LIMIT 5
`).all();
console.log('\nTop 5 by yes-rate (any of these → Match if the user swipes yes):');
tierSummary.forEach(r =>
  console.log(`  ${r.label.padEnd(30)} ${r.yes}Y · ${r.no}N · ${r.total} total (${Math.round((r.yes / r.total) * 100)}%)`)
);
