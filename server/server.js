import express from 'express';
import cors from 'cors';
import { statements } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 3001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'swipe-admin';

function isValidSessionId(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 64;
}

function isValidChoice(c) {
  return c === 'yes' || c === 'no';
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/items', (_req, res) => {
  const rows = statements.listItems.all();
  res.json(rows.map(r => ({
    id: r.id,
    label: r.label,
    description: r.description,
    image_url: r.image_url,
  })));
});

app.post('/api/vote', (req, res) => {
  const { itemId, choice, sessionId, decisionMs } = req.body ?? {};
  if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'itemId must be an integer' });
  if (!isValidChoice(choice)) return res.status(400).json({ error: "choice must be 'yes' or 'no'" });
  if (!isValidSessionId(sessionId)) return res.status(400).json({ error: 'invalid sessionId' });
  if (!statements.itemExists.get(itemId)) return res.status(404).json({ error: 'item not found' });

  // decisionMs is optional. Cap to a sane upper bound so a tab that sat idle
  // for hours doesn't poison the average.
  let dms = null;
  if (Number.isFinite(decisionMs) && decisionMs >= 0 && decisionMs <= 5 * 60 * 1000) {
    dms = Math.round(decisionMs);
  }

  statements.upsertVote.run({ itemId, choice, sessionId, decisionMs: dms });
  res.json({ ok: true });
});

app.delete('/api/vote', (req, res) => {
  const { itemId, sessionId } = req.body ?? {};
  if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'itemId must be an integer' });
  if (!isValidSessionId(sessionId)) return res.status(400).json({ error: 'invalid sessionId' });
  statements.deleteVote.run(sessionId, itemId);
  res.json({ ok: true });
});

app.get('/api/results', (_req, res) => {
  const rows = statements.results.all();
  res.json(rows.map(r => ({
    itemId: r.itemId,
    label: r.label,
    image_url: r.image_url,
    yes: r.yes,
    no: r.no,
    total: r.total,
    yes_rate: r.total > 0 ? r.yes / r.total : 0,
  })));
});

app.get('/api/votes/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) return res.status(400).json({ error: 'invalid sessionId' });
  res.json(statements.votesBySession.all(sessionId));
});

app.get('/api/stats', (_req, res) => {
  const row = statements.stats.get();
  res.json({
    totalVotes:    row.totalVotes ?? 0,
    sessions:      row.sessions   ?? 0,
    avgDecisionMs: row.avgDecisionMs != null ? Math.round(row.avgDecisionMs) : null,
  });
});

// Admin: add a new item without touching code. Requires X-Admin-Key header.
// Default key is 'swipe-admin' (override via ADMIN_KEY env var).
app.post('/api/items', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { label, description, image_url } = req.body ?? {};
  if (typeof label !== 'string' || !label.trim() || label.length > 80) {
    return res.status(400).json({ error: 'label must be a non-empty string ≤ 80 chars' });
  }
  if (typeof image_url !== 'string' || !/^https?:\/\//.test(image_url)) {
    return res.status(400).json({ error: 'image_url must be an http(s) URL' });
  }
  const desc = (typeof description === 'string' ? description.trim() : '').slice(0, 200);
  const info = statements.insertItem.run(label.trim(), desc, image_url.trim());
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.listen(PORT, () => {
  console.log(`SwipeVote API listening on http://localhost:${PORT}`);
});
