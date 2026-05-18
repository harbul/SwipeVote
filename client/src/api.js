const BASE = '/api';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`${r.status} ${r.statusText}: ${text}`);
  }
  return r.json();
}

export const api = {
  items:   ()                                  => req('/items'),
  results: ()                                  => req('/results'),
  myVotes: (sessionId)                         => req(`/votes/${encodeURIComponent(sessionId)}`),
  vote:    ({ itemId, choice, sessionId })     => req('/vote',  { method: 'POST',   body: JSON.stringify({ itemId, choice, sessionId }) }),
  undo:    ({ itemId, sessionId })             => req('/vote',  { method: 'DELETE', body: JSON.stringify({ itemId, sessionId }) }),
};
