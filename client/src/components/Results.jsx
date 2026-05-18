import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api.js';

const SORTS = [
  { key: 'loved',    label: 'Most Loved' },
  { key: 'divisive', label: 'Most Divisive' },
  { key: 'skipped',  label: 'Most Skipped' },
];

const POLL_MS = 5000;

const HERO_LABEL = {
  loved:    'BEST IN SHOW',
  divisive: 'THE GREAT DEBATE',
  skipped:  'LEAST SEEN',
};
const HERO_TAG = {
  loved:    'BEST',
  divisive: 'DIVIDED',
  skipped:  'SKIPPED',
};
const REST_LABEL = {
  loved:    'THE REST OF THE PACK',
  divisive: 'OTHER DIVIDERS',
  skipped:  'ALSO QUIET',
};

export default function Results() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState('loved');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    let timer;
    const load = async () => {
      try {
        const data = await api.results();
        if (!cancel) setRows(data);
      } catch (e) {
        if (!cancel) setError(e.message);
      } finally {
        if (!cancel) timer = setTimeout(load, POLL_MS);
      }
    };
    load();
    return () => { cancel = true; clearTimeout(timer); };
  }, []);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const arr = rows.slice();
    if (sort === 'loved') {
      arr.sort((a, b) => {
        if (a.total === 0 && b.total === 0) return 0;
        if (a.total === 0) return 1;
        if (b.total === 0) return -1;
        return b.yes_rate - a.yes_rate || b.total - a.total;
      });
    } else if (sort === 'divisive') {
      arr.sort((a, b) => {
        const aScore = a.total < 2 ? Infinity : Math.abs(0.5 - a.yes_rate);
        const bScore = b.total < 2 ? Infinity : Math.abs(0.5 - b.yes_rate);
        return aScore - bScore || b.total - a.total;
      });
    } else {
      arr.sort((a, b) => a.total - b.total || a.label.localeCompare(b.label));
    }
    return arr;
  }, [rows, sort]);

  if (error) return <div className="loading">Couldn't load results — {error}</div>;
  if (!sorted) return <div className="loading">Tallying votes…</div>;

  const totalVotes = sorted.reduce((s, r) => s + r.total, 0);
  const hero = sorted[0];
  const rest = sorted.slice(1);

  return (
    <section className="section results">
      <div className="results__masthead">
        <div className="results__kicker">Volume 01 · Live Tally</div>
        <h1 className="results__title">The <em>Verdict</em></h1>
        <div className="results__byline">{totalVotes} votes counted · refreshing every 5s</div>
      </div>

      <Segmented value={sort} onChange={setSort} options={SORTS} />

      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          {hero && (
            <motion.div
              key={`${sort}-${hero.itemId}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            >
              <HeroCard row={hero} kicker={HERO_LABEL[sort]} sort={sort} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="r-divider">
          <span className="r-divider__label">{REST_LABEL[sort]}</span>
        </div>

        <div className="r-spread">
          {rest.map((row, i) => (
            <motion.div
              layout
              key={row.itemId}
              className="r-tile"
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <span className="r-tile__rank" aria-hidden="true">
                {String(i + 2).padStart(2, '0')}
              </span>
              <img
                className="r-tile__img"
                src={row.image_url}
                alt=""
                loading="lazy"
              />
              <h3 className="r-tile__name">{row.label}</h3>
              <div className="r-tile__meta">
                <span>
                  {row.total === 0
                    ? 'NO VOTES'
                    : `${row.yes}Y · ${row.no}N`}
                </span>
                <span className="r-tile__pct">
                  {row.total === 0 ? '—' : `${Math.round(row.yes_rate * 100)}%`}
                </span>
              </div>
              <div className="r-tile__bar" aria-hidden="true">
                <motion.div
                  className="r-tile__bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.yes_rate || 0) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    </section>
  );
}

function HeroCard({ row, kicker, sort }) {
  const pct = row.total === 0 ? null : Math.round(row.yes_rate * 100);
  const lastWord = row.label.split(' ').slice(-1)[0];
  const firstWords = row.label.split(' ').slice(0, -1).join(' ');

  const caption = (() => {
    if (row.total === 0) return 'Awaiting first verdict from the floor.';
    if (sort === 'loved') {
      return `${row.yes} of ${row.total} voter${row.total === 1 ? '' : 's'} fell in love. ${pct}% yes.`;
    }
    if (sort === 'divisive') {
      const lean = row.yes_rate >= 0.5 ? 'lean yes' : 'lean no';
      return `Split the floor. ${row.yes} yes, ${row.no} no — ${pct}% ${lean}.`;
    }
    return `Only ${row.total} vote${row.total === 1 ? '' : 's'} so far. The crowd hasn't decided.`;
  })();

  return (
    <article className="r-hero">
      <div className="r-hero__kicker">{kicker}</div>

      <div className="r-hero__image-wrap">
        <img className="r-hero__image" src={row.image_url} alt={row.label} />
        <div className="r-hero__rank-overlay">
          <span className="r-hero__rank">01</span>
          <span className="r-hero__rank-rule" />
          <span className="r-hero__rank-tag">{HERO_TAG[sort]}</span>
        </div>
      </div>

      <div className="r-hero__body">
        <h2 className="r-hero__name">
          {firstWords ? `${firstWords} ` : ''}<em>{lastWord}</em>
        </h2>
        <div className="r-hero__pct">
          {pct === null ? <span className="r-hero__pct-dash">—</span> : (
            <>{pct}<sup>%</sup></>
          )}
        </div>
      </div>

      <p className="r-hero__caption">{caption}</p>
    </article>
  );
}

function Segmented({ value, onChange, options }) {
  const activeIndex = Math.max(0, options.findIndex(o => o.key === value));
  return (
    <div className="segmented" role="tablist">
      <motion.div
        className="segmented__pill"
        animate={{
          left:  `calc(${(activeIndex * 100) / options.length}% + 4px)`,
          right: `calc(${((options.length - 1 - activeIndex) * 100) / options.length}% + 4px)`,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      />
      {options.map(o => (
        <button
          key={o.key}
          className={`segmented__option ${o.key === value ? 'segmented__option--active' : ''}`}
          onClick={() => onChange(o.key)}
          role="tab"
          aria-selected={o.key === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
