import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, FilterX, LayoutGrid, List, RotateCcw, Search, SearchX, Shuffle, Timer } from 'lucide-react';
import { bestByScenario } from '../engine/progress';
import { useStore } from '../state/store';
import { CATEGORIES, type Category } from '../types';
import { BestScorePill, CategoryPill, DifficultyDots, EmptyState, NewPill, PageHeader, PriorityPill, ticketNumber, useNow } from '../components/ui';
import { CHANNEL_LABEL, CategoryIcon, ChannelIcon } from '../components/icons';
import '../styles/queue-review.css';
import { loggedPriority } from '../engine/triage';

/** Best score at or above this counts as passed (matches the status filter). */
const PASS_MARK = 70;

const CATEGORY_OPTIONS: (Category | 'All')[] = ['All', ...CATEGORIES];

/** Tracks whether a horizontal scroller has hidden content on either side, so its edges can fade. */
function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft < max - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);
  return [ref, edges] as const;
}

const VIEW_KEY = 'tierone-queue-view';

export function Queue() {
  const { state, scenarios, works } = useStore();
  const navigate = useNavigate();
  const now = useNow(5000);
  // Resolutions that did not hold come back once they are due.
  const reopened = state.reopens
    .filter((r) => r.dueAt <= now && !works.some((w) => w.scenario.id === r.scenarioId))
    .flatMap((r) => {
      const sc = scenarios.find((x) => x.id === r.scenarioId);
      return sc ? [{ r, sc }] : [];
    });
  const best = bestByScenario(state);
  // Filters live in the address (?cat=Network&level=2&status=new&q=vpn): Back from a ticket returns to the same
  // list, and a filtered queue can be bookmarked. Changes replace the entry so typing doesn't fill the history.
  const [params, setParams] = useSearchParams();
  const catParam = params.get('cat') ?? '';
  const cat: Category | 'All' = (CATEGORIES as string[]).includes(catParam) ? (catParam as Category) : 'All';
  const levelParam = Number(params.get('level'));
  const diff = ([1, 2, 3].includes(levelParam) ? levelParam : 0) as 0 | 1 | 2 | 3;
  const statusParam = params.get('status') ?? '';
  const status = (['new', 'passed', 'retry'].includes(statusParam) ? statusParam : 'all') as 'all' | 'new' | 'passed' | 'retry';
  const q = params.get('q') ?? '';
  const setFilters = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );
  const setCat = (c: Category | 'All') => setFilters({ cat: c === 'All' ? null : c });
  const setDiff = (d: 0 | 1 | 2 | 3) => setFilters({ level: d ? String(d) : null });
  const setStatus = (v: 'all' | 'new' | 'passed' | 'retry') => setFilters({ status: v === 'all' ? null : v });
  const setQ = (v: string) => setFilters({ q: v || null });
  const [view, setView] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const changeView = (v: 'cards' | 'list') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Storage unavailable: the choice just won't be remembered.
    }
  };
  const [catsRef, catEdges] = useScrollEdges<HTMLDivElement>();

  const list = useMemo(
    () =>
      scenarios.filter((s) => {
        if (cat !== 'All' && s.category !== cat) return false;
        if (diff && s.difficulty !== diff) return false;
        const b = best[s.id];
        if (status === 'new' && b !== undefined) return false;
        if (status === 'passed' && !(b !== undefined && b >= PASS_MARK)) return false;
        if (status === 'retry' && !(b !== undefined && b < PASS_MARK)) return false;
        if (q && !`${s.title} ${s.description} ${s.requester.name}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [scenarios, cat, diff, status, q, best],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: scenarios.length };
    for (const s of scenarios) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, [scenarios]);

  const filtersActive = cat !== 'All' || diff !== 0 || status !== 'all' || q !== '';
  const clearFilters = () => setFilters({ cat: null, level: null, status: null, q: null });

  const random = () => {
    const pool = list.length ? list : scenarios;
    if (!pool.length) return;
    navigate(`/ticket/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };

  return (
    <div className="page queue-page">
      <PageHeader
        title="Ticket queue"
        description="Pick a ticket to work. There's no timer pressure here; use shift mode for that."
        actions={
          <button className="btn btn-primary" onClick={random} title="Open a random ticket from the current results">
            <Shuffle size={16} aria-hidden />
            Random ticket
          </button>
        }
      />

      {reopened.length > 0 && (
        <section className="card queue-reopened" aria-labelledby="queue-reopened-h">
          <div className="card-head">
            <h2 id="queue-reopened-h">Reopened</h2>
            <span className="pill pill-danger num">{reopened.length}</span>
          </div>
          <ul className="queue-reopened-list">
            {reopened.map(({ r, sc }) => (
              <li key={r.attemptId}>
                <Link to={`/ticket/${sc.id}?reopen=${r.attemptId}`} className="queue-reopened-row">
                  <RotateCcw size={16} aria-hidden />
                  <span>
                    <span className="mono">{ticketNumber(sc.id)}</span> <strong>{sc.title}</strong>
                    <span className="muted"> · {r.reason}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card card-tight queue-filters" aria-label="Filter tickets">
        <div className="queue-filter-row">
          <div className="search queue-search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Search tickets, requesters…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
          </div>
          <select className="queue-select" value={diff} onChange={(e) => setDiff(Number(e.target.value) as 0 | 1 | 2 | 3)} aria-label="Difficulty">
            <option value={0}>Any difficulty</option>
            <option value={1}>Beginner</option>
            <option value={2}>Intermediate</option>
            <option value={3}>Advanced</option>
          </select>
          <select className="queue-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="all">All tickets</option>
            <option value="new">Not attempted</option>
            <option value="passed">Passed ({PASS_MARK}+)</option>
            <option value="retry">Needs retry</option>
          </select>
        </div>

        <div
          ref={catsRef}
          className={`seg queue-cats${catEdges.start ? ' fade-start' : ''}${catEdges.end ? ' fade-end' : ''}`}
          role="group"
          aria-label="Category"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={cat === c ? 'active' : ''}
              aria-pressed={cat === c}
              onClick={(e) => {
                setCat(c);
                // Keep the chosen option clear of the faded edge when the row scrolls.
                e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }}
            >
              {c === 'All' ? <LayoutGrid size={14} aria-hidden /> : <CategoryIcon category={c} size={14} />}
              {c}
              <span className="seg-count num">{categoryCounts[c] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="queue-results-wrap">
        <div className="queue-results">
          <p className="queue-results-text" aria-live="polite">
            {filtersActive ? (
              <>
                <strong className="num">{list.length}</strong> of <span className="num">{scenarios.length}</span> tickets match
              </>
            ) : (
              <>
                <strong className="num">{scenarios.length}</strong> tickets
              </>
            )}
          </p>
          <div className="queue-results-actions">
            {filtersActive && list.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <FilterX size={14} aria-hidden />
                Clear filters
              </button>
            )}
            <div className="seg" role="group" aria-label="Layout">
              <button type="button" className={view === 'cards' ? 'active' : ''} aria-pressed={view === 'cards'} onClick={() => changeView('cards')} title="Card view">
                <LayoutGrid size={14} aria-hidden />
                Cards
              </button>
              <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => changeView('list')} title="List view">
                <List size={14} aria-hidden />
                List
              </button>
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="card">
            <EmptyState icon={SearchX} title={filtersActive ? 'No tickets match these filters' : 'No tickets available'}>
              {filtersActive ? (
                <div className="qr-empty-body">
                  <span>Try another category, difficulty or status, or clear the search.</span>
                  <button type="button" className="btn btn-sm" onClick={clearFilters}>
                    <FilterX size={14} aria-hidden />
                    Clear filters
                  </button>
                </div>
              ) : (
                'Add a scenario in the scenario builder to see it here.'
              )}
            </EmptyState>
          </div>
        ) : view === 'list' ? (
          <div className="card queue-list-card">
            <div className="table-wrap">
              <table className="table queue-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Priority</th>
                    <th className="ql-hide-md">Category</th>
                    <th className="ql-hide-md">Requester</th>
                    <th className="ql-hide-sm">Target</th>
                    <th className="ql-hide-sm">Difficulty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const b = best[s.id];
                    return (
                      <tr key={s.id} className="queue-row" onClick={() => navigate(`/ticket/${s.id}`)}>
                        <td>
                          <Link to={`/ticket/${s.id}`} className="queue-row-link" onClick={(e) => e.stopPropagation()}>
                            <span className="ticket-id">{ticketNumber(s.id)}</span>
                            <span className="queue-row-title">{s.title}</span>
                          </Link>
                        </td>
                        <td>
                          <PriorityPill p={loggedPriority(s)} />
                        </td>
                        <td className="ql-hide-md">
                          <CategoryPill category={s.category} />
                        </td>
                        <td className="ql-hide-md">
                          <span className="queue-card-req">
                            <ChannelIcon channel={s.channel} />
                            <span className="qr-truncate">{s.requester.name}</span>
                          </span>
                        </td>
                        <td className="ql-hide-sm num">~{s.targetMinutes} min</td>
                        <td className="ql-hide-sm">
                          <DifficultyDots d={s.difficulty} />
                        </td>
                        <td>
                          {works.some((w) => w.scenario.id === s.id) ? (
                            <span className="pill pill-info">
                              <Timer aria-hidden />
                              In progress
                            </span>
                          ) : b !== undefined ? (
                            <BestScorePill score={b} />
                          ) : (
                            <NewPill />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-auto">
            {list.map((s) => {
              const b = best[s.id];
              return (
                <Link key={s.id} to={`/ticket/${s.id}`} className="card ticket-card queue-card">
                  <div className="queue-card-top">
                    <span className="ticket-id">{ticketNumber(s.id)}</span>
                    <div className="queue-card-tags">
                      <PriorityPill p={loggedPriority(s)} />
                      <CategoryPill category={s.category} />
                      {s.custom && <span className="pill pill-info">Custom</span>}
                    </div>
                    {works.some((w) => w.scenario.id === s.id) ? (
                      <span className="pill pill-info">
                        <Timer aria-hidden />
                        In progress
                      </span>
                    ) : b !== undefined ? (
                      <BestScorePill score={b} />
                    ) : (
                      <NewPill />
                    )}
                  </div>

                  <div className="title">{s.title}</div>
                  <p className="queue-card-desc">{s.description}</p>

                  <div className="queue-card-foot">
                    <span className="queue-card-req" title={`Received via ${CHANNEL_LABEL[s.channel]}`}>
                      <ChannelIcon channel={s.channel} />
                      <span className="qr-truncate">
                        {s.requester.name} · {s.requester.department}
                      </span>
                    </span>
                    <span className="queue-card-meta">
                      <span className="inline-icon num" title="Target handling time">
                        <Clock size={14} aria-hidden />~{s.targetMinutes} min
                      </span>
                      <DifficultyDots d={s.difficulty} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
