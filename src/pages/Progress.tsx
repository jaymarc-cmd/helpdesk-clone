import { Link } from 'react-router-dom';
import { BADGES, RANKS, categoryStats, overallStats, rankFor, totalXp } from '../engine/progress';
import { useStore } from '../state/store';
import { CATEGORIES } from '../types';
import { ProgressBar, Stars, formatClock, scoreTone, timeAgo } from '../components/ui';

export function ProgressPage() {
  const { state } = useStore();
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const stats = overallStats(state);
  const cats = categoryStats(state);
  const earned = new Map(state.badges.map((b) => [b.id, b.earnedAt]));

  // Section averages across all attempts reveal skill gaps.
  const sectionAvg = (key: string) => {
    const xs = state.tickets.map((t) => {
      const s = t.result.sections.find((x) => x.key === key)!;
      return s.score / s.max;
    });
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const sectionKeys = [
    ['diagnosis', 'Diagnosis'],
    ['investigation', 'Investigation'],
    ['resolution', 'Resolution'],
    ['process', 'Process & Security'],
    ['communication', 'Communication'],
    ['documentation', 'Documentation'],
    ['time', 'Handling Time'],
  ] as const;
  const weakest = state.tickets.length ? [...sectionKeys].sort((a, b) => sectionAvg(a[0]) - sectionAvg(b[0]))[0] : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Your progress</h1>
          <p>
            Level {rank.level} · {rank.current.title} · {xp} XP
          </p>
        </div>
        <button className="btn no-print" onClick={() => window.print()}>
          🖨 Print training record
        </button>
      </div>

      <div className="card">
        <h2>Career ladder</h2>
        <div className="stack" style={{ gap: 8 }}>
          {RANKS.map((r, i) => {
            const next = RANKS[i + 1];
            const reached = xp >= r.xp;
            const frac = reached ? (next ? Math.min(1, (xp - r.xp) / (next.xp - r.xp)) : 1) : 0;
            return (
              <div key={r.title} className="row" style={{ flexWrap: 'nowrap' }}>
                <span style={{ width: 24 }}>{reached ? '✅' : '🔒'}</span>
                <span style={{ width: 200, fontWeight: reached ? 700 : 400 }} className="small">
                  {r.title}
                </span>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={frac} />
                </div>
                <span className="tiny muted" style={{ width: 70, textAlign: 'right' }}>
                  {r.xp} XP
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Skill breakdown</h2>
          {state.tickets.length === 0 ? (
            <p className="muted">Complete a ticket to see your skill breakdown.</p>
          ) : (
            <>
              <div className="stack" style={{ gap: 10 }}>
                {sectionKeys.map(([k, label]) => (
                  <div key={k}>
                    <div className="spread small">
                      <span>{label}</span>
                      <span className="muted">{Math.round(sectionAvg(k) * 100)}%</span>
                    </div>
                    <ProgressBar value={sectionAvg(k)} tone={scoreTone(sectionAvg(k) * 100)} />
                  </div>
                ))}
              </div>
              {weakest && (
                <div className="callout warning small mt">
                  Focus area: <strong>{weakest[1]}</strong>.{' '}
                  {weakest[0] === 'communication' && 'Greet by name, show empathy, explain plainly, and close with next steps.'}
                  {weakest[0] === 'documentation' && 'Write notes as symptom → findings → cause → actions → result.'}
                  {weakest[0] === 'process' && 'Verify identity before sensitive changes and avoid shotgun troubleshooting.'}
                  {weakest[0] === 'investigation' && 'Ask more questions and use the tools before deciding on a fix.'}
                  {weakest[0] === 'diagnosis' && 'Gather evidence until one root cause clearly fits all the facts.'}
                  {weakest[0] === 'resolution' && 'Check whether a ticket belongs with another team, and complete every fix step.'}
                  {weakest[0] === 'time' && 'Use Shift Mode to practise working efficiently under SLA pressure.'}
                </div>
              )}
            </>
          )}
        </div>
        <div className="card">
          <h2>Categories</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Passed</th>
                  <th>Attempts</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c}>
                    <td>{c}</td>
                    <td>
                      {cats[c].completed}/{cats[c].total}
                    </td>
                    <td>{cats[c].attempts}</td>
                    <td>{cats[c].attempts ? <span className={`pill pill-${scoreTone(cats[c].avg)}`}>{cats[c].avg}</span> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row mt small muted">
            <span>{stats.tickets} tickets</span>·<span>avg {stats.avgScore || '–'}</span>·
            <span>{stats.tickets ? <Stars value={stats.avgCsat} /> : 'no CSAT yet'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          Badges ({state.badges.length}/{BADGES.length})
        </h2>
        <div className="grid grid-3">
          {BADGES.map((b) => (
            <div key={b.id} className={`badge-tile ${earned.has(b.id) ? '' : 'locked'}`}>
              <div className="icon">{b.icon}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                <div className="tiny muted">{b.description}</div>
                {earned.has(b.id) && <div className="tiny" style={{ color: 'var(--success)' }}>Earned {timeAgo(earned.get(b.id)!)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Ticket history</h2>
        {state.tickets.length === 0 ? (
          <p className="muted">No tickets yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Category</th>
                  <th>Mode</th>
                  <th>Time</th>
                  <th>CSAT</th>
                  <th>Score</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...state.tickets].reverse().map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/review/${t.id}`}>{t.title}</Link>
                    </td>
                    <td>{t.category}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.mode}</td>
                    <td>{formatClock(t.durationSec)}</td>
                    <td>
                      <Stars value={t.result.csat} />
                    </td>
                    <td>
                      <span className={`pill pill-${scoreTone(t.result.total)}`}>
                        {t.result.total} {t.result.grade}
                      </span>
                    </td>
                    <td className="small muted">{timeAgo(t.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
