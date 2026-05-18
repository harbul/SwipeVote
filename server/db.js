import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'swipevote.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    choice TEXT NOT NULL CHECK(choice IN ('yes','no')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(session_id, item_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id);
  CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
`);

export const statements = {
  listItems: db.prepare('SELECT id, label, description, image_url FROM items ORDER BY id'),
  itemExists: db.prepare('SELECT 1 FROM items WHERE id = ?'),
  upsertVote: db.prepare(`
    INSERT INTO votes (session_id, item_id, choice)
    VALUES (@sessionId, @itemId, @choice)
    ON CONFLICT(session_id, item_id) DO UPDATE SET
      choice = excluded.choice,
      created_at = strftime('%s','now')
  `),
  deleteVote: db.prepare('DELETE FROM votes WHERE session_id = ? AND item_id = ?'),
  results: db.prepare(`
    SELECT
      i.id AS itemId,
      i.label,
      i.image_url,
      COALESCE(SUM(CASE WHEN v.choice = 'yes' THEN 1 ELSE 0 END), 0) AS yes,
      COALESCE(SUM(CASE WHEN v.choice = 'no'  THEN 1 ELSE 0 END), 0) AS no,
      COUNT(v.id) AS total
    FROM items i
    LEFT JOIN votes v ON v.item_id = i.id
    GROUP BY i.id, i.label, i.image_url
    ORDER BY i.id
  `),
  votesBySession: db.prepare('SELECT item_id AS itemId, choice FROM votes WHERE session_id = ?'),
  insertItem: db.prepare('INSERT INTO items (label, description, image_url) VALUES (?, ?, ?)'),
  clearItems: db.prepare('DELETE FROM items'),
  clearVotes: db.prepare('DELETE FROM votes'),
};
