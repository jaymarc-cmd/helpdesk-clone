import { Link } from 'react-router-dom';
import { CALLS } from '../data/calls';
import { useStore } from '../state/store';
import { DifficultyDots, initials, scoreTone, timeAgo } from '../components/ui';

export function CallsPage() {
  const { state, dispatch } = useStore();
  const best: Record<string, number> = {};
  for (const c of state.calls) best[c.callId] = Math.max(best[c.callId] ?? 0, c.score);
  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Voice Calls</h1>
          <p>Live phone simulations with spoken callers. Every choice changes the caller's mood and the outcome.</p>
        </div>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={state.settings.voice} onChange={(e) => dispatch({ type: 'settings', patch: { voice: e.target.checked } })} />
          🔊 Caller voice {speechOk ? '' : '(not supported in this browser)'}
        </label>
      </div>

      <div className="grid grid-auto">
        {CALLS.map((c) => (
          <div key={c.id} className="card stack">
            <div className="row">
              <div className="avatar" style={{ width: 48, height: 48, fontSize: '1rem' }}>
                {initials(c.caller)}
              </div>
              <div>
                <strong>{c.title}</strong>
                <div className="tiny muted">
                  {c.caller} · {c.role}
                </div>
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {c.summary}
            </p>
            <div className="row">
              {c.skills.map((s) => (
                <span key={s} className="pill">
                  {s}
                </span>
              ))}
            </div>
            <div className="spread">
              <DifficultyDots d={c.difficulty} />
              {best[c.id] !== undefined && <span className={`pill pill-${scoreTone(best[c.id])}`}>Best {best[c.id]}</span>}
            </div>
            <Link className="btn btn-primary" to={`/call/${c.id}`}>
              📞 Take call
            </Link>
          </div>
        ))}
      </div>

      {state.calls.length > 0 && (
        <div className="card">
          <h3>Recent calls</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Call</th>
                  <th>Score</th>
                  <th>Final mood</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...state.calls].reverse().slice(0, 10).map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>
                      <span className={`pill pill-${scoreTone(c.score)}`}>{c.score}</span>
                    </td>
                    <td>{c.finalMood}/10</td>
                    <td>{timeAgo(c.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
