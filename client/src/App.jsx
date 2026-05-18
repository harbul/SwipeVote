import { useState, useMemo, useEffect } from 'react';
import SwipeDeck from './components/SwipeDeck.jsx';
import Results from './components/Results.jsx';
import Matches from './components/Matches.jsx';
import TabBar from './components/TabBar.jsx';
import Admin from './components/Admin.jsx';
import { getOrCreateSessionId } from './session.js';

const isAdminPath = () => window.location.pathname.startsWith('/admin');

export default function App() {
  // All hooks declared unconditionally before any early returns.
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [view, setView] = useState('deck');
  const [adminMode, setAdminMode] = useState(isAdminPath);

  useEffect(() => {
    const handler = () => setAdminMode(isAdminPath());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  if (adminMode) return <Admin />;

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
