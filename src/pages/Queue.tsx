import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bestByScenario } from '../engine/progress';
import { useStore } from '../state/store';
import { CATEGORIES, type Category } from '../types';
import { DifficultyDots, PriorityPill, scoreTone } from '../components/ui';

const CHANNEL_ICON = { email: '✉️', portal: '🌐', phone: '☎️', chat: '💬' } as const;

export function Queue() {
  const { state, scenarios } = useStore();
  const navigate = useNavigate();
  const best = bestByScenario(state);
  const [cat, setCat] = useState<Category | 'All'>('All');
  const [diff, setDiff] = useState<0 | 1 | 2 | 3>(0);
  const [status, setStatus] = useState<'all' | 'new' | 'passed' | 'retry'>('all');
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      scenarios.filter((s) => {
        if (cat !== 'All' && s.category !== cat) return false;
        if (diff && s.difficulty !== diff) return false;
        const b = best[s.id];
        if (status === 'new' && b !== undefined) return false;
        if (status === 'passed' && !(b !== undefined && b >= 70)) return false;
        if (status === 'retry' && !(b !== undefined && b < 70)) return false;
        if (q && !`${s.title} ${s.description} ${s.requester.name}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [scenarios, cat, diff, status, q, best],
  );

  const random = () => {
    const pool = list.length ? list : scenarios;
    navigate(`/ticket/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ticket Queue</h1>
          <p>Pick a ticket to work. There's no timer pressure here; use Shift Mode for that.</p>
        </div>
        <button className="btn btn-primary" onClick={random}>
          🎲 Random ticket
        </button>
      </div>

      <div className="card card-tight mb">
        <div className="row">
          <input type="search" placeholder="Search tickets, requesters…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px', width: 'auto' }} />
          <select value={cat} onChange={(e) => setCat(e.target.value as Category | 'All')} style={{ width: 'auto' }} aria-label="Category">
            <option>All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={diff} onChange={(e) => setDiff(Number(e.target.value) as 0 | 1 | 2 | 3)} style={{ width: 'auto' }} aria-label="Difficulty">
            <option value={0}>Any difficulty</option>
            <option value={1}>Beginner</option>
            <option value={2}>Intermediate</option>
            <option value={3}>Advanced</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ width: 'auto' }} aria-label="Status">
            <option value="all">All tickets</option>
            <option value="new">Not attempted</option>
            <option value="passed">Passed (70+)</option>
            <option value="retry">Needs retry</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card empty">No tickets match these filters.</div>
      ) : (
        <div className="grid grid-auto">
          {list.map((s) => {
            const b = best[s.id];
            return (
              <Link key={s.id} to={`/ticket/${s.id}`} className="card ticket-card">
                <div className="spread">
                  <div className="row">
                    <PriorityPill p={s.priority} />
                    <span className="pill">{s.category}</span>
                    {s.custom && <span className="pill pill-info">Custom</span>}
                  </div>
                  {b !== undefined ? <span className={`pill pill-${scoreTone(b)}`}>Best {b}</span> : <span className="pill pill-primary">New</span>}
                </div>
                <div className="title">{s.title}</div>
                <div className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {s.description}
                </div>
                <div className="spread tiny muted">
                  <span>
                    {CHANNEL_ICON[s.channel]} {s.requester.name} · {s.requester.department}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span>~{s.targetMinutes} min</span>
                    <DifficultyDots d={s.difficulty} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
