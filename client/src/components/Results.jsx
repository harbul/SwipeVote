import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';

const SORTS = [
  { key: 'loved',    label: 'Most Loved' },
  { key: 'divisive', label: 'Most Divisive' },
  { key: 'skipped',  label: 'Most Skipped' },
];

const POLL_MS = 5000; // stretch: poll for live updates

export default function Results() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState('loved');
  const [error, setError] = useState(null);

  // Initial + polling fetch
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
      // Most loved: yes_rate desc, ties → more votes first; require total > 0
      arr.sort((a, b) => {
        if (a.total === 0 && b.total === 0) return 0;
        if (a.total === 0) return 1;
        if (b.total === 0) return -1;
        return b.yes_rate - a.yes_rate || b.total - a.total;
      });
    } else if (sort === 'divisive') {
      // Closest to 50/50 among items with at least 2 votes
      arr.sort((a, b) => {
        const aScore = a.total < 2 ? Infinity : Math.abs(0.5 - a.yes_rate);
        const bScore = b.total < 2 ? Infinity : Math.abs(0.5 - b.yes_rate);
        return aScore - bScore || b.total - a.total;
      });
    } else {
      // Most skipped: lowest total first; alphabetical on tie
      arr.sort((a, b) => a.total - b.total || a.label.localeCompare(b.label));
    }
    return arr;
  }, [rows, sort]);

  if (error) return <div className="loading">Couldn't load results — {error}</div>;
  if (!sorted) return <div className="loading">Tallying votes…</div>;

  const totalVotes = sorted.reduce((s, r) => s + r.total, 0);

  return (
    <section className="section">
      <header className="section__head">
        <h1 className="section__title">The <em>Results</em></h1>
        <span className="section__meta">{totalVotes} votes · live</span>
      </header>

      <Segmented value={sort} onChange={setSort} options={SORTS} />

      <div className="r-list">
        {sorted.map((row, i) => (
          <ResultRow key={row.itemId} row={row} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}

function ResultRow({ row, rank }) {
  const pct = row.total === 0 ? null : Math.round(row.yes_rate * 100);
  return (
    <article className="r-row">
      <img className="r-row__img" src={row.image_url} alt="" loading="lazy" />
      <div className="r-row__info">
        <div className="r-row__name">
          <span className="r-rank">№{String(rank).padStart(2, '0')}</span>
          {row.label}
        </div>
        <div className="r-row__sub">
          {row.total === 0
            ? 'AWAITING VOTES'
            : `${row.yes} YES · ${row.no} NO · ${row.total} TOTAL`}
        </div>
      </div>
      <div className={`r-row__pct ${pct === null || pct < 50 ? 'r-row__pct--lo' : ''}`}>
        {pct === null ? '—' : `${pct}%`}
      </div>
      <div className="r-bar">
        <motion.div
          className="r-bar__fill"
          initial={{ width: 0 }}
          animate={{ width: `${(row.yes_rate || 0) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
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
