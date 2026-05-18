import { useState, useMemo } from 'react';
import SwipeDeck from './components/SwipeDeck.jsx';
import Results from './components/Results.jsx';
import Matches from './components/Matches.jsx';
import TabBar from './components/TabBar.jsx';
import { getOrCreateSessionId } from './session.js';

export default function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [view, setView] = useState('deck');

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          Swipe<span className="brand-dot" />Vote <em>·</em>
        </div>
        <div className="app__sub">A curated kennel · est. 2025</div>
      </header>

      {view === 'deck'    && <SwipeDeck sessionId={sessionId} onOpenResults={() => setView('results')} />}
      {view === 'results' && <Results />}
      {view === 'matches' && <Matches sessionId={sessionId} />}

      <TabBar view={view} onChange={setView} />
    </div>
  );
}
