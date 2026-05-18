import { useEffect, useState } from 'react';
import { api } from '../api.js';

const GLOBAL_THRESHOLD = 0.6;
const MIN_VOTES = 2; // require at least a couple of votes before counting global yes-rate

export default function Matches({ sessionId }) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [results, myVotes] = await Promise.all([api.results(), api.myVotes(sessionId)]);
        if (cancel) return;
        const myYes = new Set(myVotes.filter(v => v.choice === 'yes').map(v => v.itemId));
        const matches = results.filter(r =>
          myYes.has(r.itemId) && r.total >= MIN_VOTES && r.yes_rate >= GLOBAL_THRESHOLD
        );
        matches.sort((a, b) => b.yes_rate - a.yes_rate);
        setData(matches);
      } catch (e) {
        if (!cancel) setErr(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [sessionId]);

  if (err) return <div className="loading">Couldn't load matches — {err}</div>;
  if (!data) return <div className="loading">Finding your matches…</div>;

  return (
    <section className="section">
      <header className="section__head">
        <h1 className="section__title">Your <em>Matches</em></h1>
        <span className="section__meta">{data.length} ·  ≥{Math.round(GLOBAL_THRESHOLD * 100)}% loved</span>
      </header>

      {data.length === 0 ? (
        <div className="empty">
          No matches yet. Swipe a few yeses on breeds the crowd also loves — they'll appear here.
        </div>
      ) : (
        <div className="m-grid">
          {data.map(r => (
            <article className="m-card" key={r.itemId}>
              <img className="m-card__img" src={r.image_url} alt={r.label} loading="lazy" />
              <div className="m-card__body">
                <div className="m-card__name">{r.label}</div>
                <div className="m-card__pct">{Math.round(r.yes_rate * 100)}% YES · {r.total} VOTES</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
