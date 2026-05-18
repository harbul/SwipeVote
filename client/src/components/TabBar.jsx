import { motion, LayoutGroup } from 'framer-motion';

const TABS = [
  { key: 'deck',    label: 'Swipe' },
  { key: 'results', label: 'Results' },
  { key: 'matches', label: 'Matches' },
];

export default function TabBar({ view, onChange }) {
  return (
    <nav className="tabbar" role="tablist">
      <LayoutGroup>
        {TABS.map(t => {
          const active = t.key === view;
          return (
            <button
              key={t.key}
              className={`tabbar__btn ${active ? 'tabbar__btn--active' : ''}`}
              onClick={() => onChange(t.key)}
              role="tab"
              aria-selected={active}
            >
              {active && <motion.span className="tabbar__pill" layoutId="tabbar-pill" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
              <span style={{ position: 'relative', zIndex: 2 }}>{t.label}</span>
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
