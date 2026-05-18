import express from 'express';
import cors from 'cors';
import { statements } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 3001;

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
  const { itemId, choice, sessionId } = req.body ?? {};
  if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'itemId must be an integer' });
  if (!isValidChoice(choice)) return res.status(400).json({ error: "choice must be 'yes' or 'no'" });
  if (!isValidSessionId(sessionId)) return res.status(400).json({ error: 'invalid sessionId' });
  if (!statements.itemExists.get(itemId)) return res.status(404).json({ error: 'item not found' });

  statements.upsertVote.run({ itemId, choice, sessionId });
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

app.listen(PORT, () => {
  console.log(`SwipeVote API listening on http://localhost:${PORT}`);
});
