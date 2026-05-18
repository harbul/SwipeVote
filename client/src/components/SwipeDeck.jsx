import { useEffect, useRef, useState, useCallback } from 'react';
import SwipeCard from './SwipeCard.jsx';
import EndOfDeck from './EndOfDeck.jsx';
import { api } from '../api.js';

/**
 * Deck of unvoted items with optimistic voting + undo history.
 * The active card animates itself out and notifies us via onExitDone; we then
 * filter the item out of the deck so the back cards slide forward cleanly.
 */
export default function SwipeDeck({ sessionId, onOpenResults }) {
  const [allItems, setAllItems] = useState(null);     // full list (in source order)
  const [voted, setVoted]       = useState(new Map()); // itemId -> 'yes' | 'no'
  const [history, setHistory]   = useState([]);        // [{ item, choice }]
  const [error, setError]       = useState(null);

  // Active card ref so the No / Yes / Undo buttons can drive the same exit animation
  const activeRef = useRef(null);

  // Load items + existing votes ------------------------------
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [items, votes] = await Promise.all([api.items(), api.myVotes(sessionId)]);
        if (cancel) return;
        setAllItems(items);
        setVoted(new Map(votes.map(v => [v.itemId, v.choice])));
      } catch (e) {
        if (!cancel) setError(e.message);
      }
    })();
    return () => { cancel = true; };
  }, [sessionId]);

  const deck    = allItems ? allItems.filter(it => !voted.has(it.id)) : [];
  const total   = allItems?.length ?? 0;
  const decided = voted.size;

  // Fired the instant a vote is decided — POST to server & record undo history.
  const handleVote = useCallback((item, choice) => {
    setHistory(prev => [...prev, { item, choice }].slice(-10));
    api.vote({ itemId: item.id, choice, sessionId }).catch(err => {
      console.error('vote failed', err);
    });
  }, [sessionId]);

  // Fired AFTER the card's exit animation — now we remove it from the deck.
  const handleExitDone = useCallback((item, choice) => {
    setVoted(prev => {
      const next = new Map(prev);
      next.set(item.id, choice);
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setVoted(prev => {
      const next = new Map(prev);
      next.delete(last.item.id);
      return next;
    });
    api.undo({ itemId: last.item.id, sessionId }).catch(err => {
      console.error('undo failed', err);
    });
  }, [history, sessionId]);

  if (error)     return <div className="loading">Couldn't load the deck — {error}</div>;
  if (!allItems) return <div className="loading">Curating the lineup…</div>;

  const visible = deck.slice(0, 3); // top + 2 behind

  return (
    <>
      <Progress decided={decided} total={total} />

      <div className="deck">
        <div className="deck__stage">
          {visible.length === 0 ? (
            <EndOfDeck onOpenResults={onOpenResults} />
          ) : (
            visible
              .slice()
              .reverse() // back card mounts first so the top card lays above
              .map((item) => {
                const position = visible.indexOf(item);
                return (
                  <SwipeCard
                    key={item.id}
                    ref={position === 0 ? activeRef : null}
                    item={item}
                    position={position}
                    active={position === 0}
                    onVote={(choice) => handleVote(item, choice)}
                    onExitDone={(choice) => handleExitDone(item, choice)}
                  />
                );
              })
          )}
        </div>

        {visible.length > 0 && (
          <div className="actions">
            <button
              className="btn btn--circle btn--no"
              onClick={() => activeRef.current?.triggerVote('no')}
              aria-label="Pass"
              title="Pass (or swipe left)"
            >✕</button>
            <button
              className="btn btn--circle btn--undo"
              onClick={handleUndo}
              disabled={history.length === 0}
              aria-label="Undo last vote"
              title="Undo"
            >↺</button>
            <button
              className="btn btn--circle btn--yes"
              onClick={() => activeRef.current?.triggerVote('yes')}
              aria-label="Adopt"
              title="Adopt (or swipe right)"
            >♥</button>
          </div>
        )}
      </div>
    </>
  );
}

function Progress({ decided, total }) {
  const pct = total === 0 ? 0 : Math.round((decided / total) * 100);
  return (
    <div className="progress" aria-label={`${decided} of ${total} reviewed`}>
      <span className="progress__count">{String(decided).padStart(3, '0')} / {total}</span>
      <div className="progress__bar"><div className="progress__fill" style={{ width: `${pct}%` }} /></div>
      <span className="progress__count">{pct}%</span>
    </div>
  );
}
