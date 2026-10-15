import { Link, useNavigate, useParams } from 'react-router-dom';
import { KB_BY_ID } from '../data/kb';
import { HINT_PENALTY } from '../engine/scoring';
import { slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import { ProgressBar, ScoreRing, Stars, formatClock, scoreTone } from '../components/ui';

export function TicketReview() {
  const { attemptId } = useParams();
  const { state, getScenario } = useStore();
  const navigate = useNavigate();
  const attempt = state.tickets.find((t) => t.id === attemptId);
  const scenario = attempt ? getScenario(attempt.scenarioId) : undefined;

  if (!attempt) {
    return (
      <div className="card empty">
        <p>Attempt not found.</p>
        <Link className="btn" to="/tickets">
          Back to queue
        </Link>
      </div>
    );
  }

  const r = attempt.result;
  const shiftTicket = state.activeShift?.tickets.find((t) => t.attemptId === attempt.id);
  const nextShiftTicket = state.activeShift?.tickets.find((t) => t.status === 'waiting');
  const rootLabel = scenario?.rootCauses.find((c) => c.id === attempt.submission.rootCause)?.label;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="small muted">Ticket review</div>
          <h1 style={{ margin: 0 }}>{attempt.title}</h1>
        </div>
        <div className="row no-print">
          {state.activeShift ? (
            <>
              <Link className="btn" to="/shift">
                Shift board
              </Link>
              {nextShiftTicket && (
                <button className="btn btn-primary" onClick={() => navigate(`/ticket/${nextShiftTicket.scenarioId}?mode=shift`)}>
                  Next shift ticket →
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn" onClick={() => window.print()}>
                🖨 Print
              </button>
              <Link className="btn" to={`/ticket/${attempt.scenarioId}`}>
                ↻ Retry
              </Link>
              <Link className="btn btn-primary" to="/tickets">
                Next ticket →
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 28, alignItems: 'center' }}>
          <ScoreRing score={r.total} label={`Grade ${r.grade}`} />
          <div className="stack" style={{ gap: 6, flex: '1 1 260px' }}>
            <div className="row">
              <span className="pill pill-primary">+{r.xp} XP</span>
              <span className="pill">⏱ {formatClock(attempt.durationSec)}</span>
              {attempt.hintsUsed > 0 && (
                <span className="pill pill-warning">
                  {attempt.hintsUsed} hint{attempt.hintsUsed > 1 ? 's' : ''} (−{attempt.hintsUsed * HINT_PENALTY})
                </span>
              )}
              {shiftTicket && scenario && (
                <span className={`pill ${shiftTicket.slaBreached ? 'pill-danger' : 'pill-success'}`}>
                  SLA {shiftTicket.slaBreached ? 'breached' : 'met'} ({formatClock((slaDeadline(shiftTicket.arrivedAt, scenario.priority) - shiftTicket.arrivedAt) / 1000)})
                </span>
              )}
            </div>
            <div>
              Customer satisfaction: <Stars value={r.csat} /> <span className="muted small">({r.csat}/5)</span>
            </div>
            <div className="small muted">
              Your diagnosis: <strong>{rootLabel ?? '—'}</strong> ·{' '}
              {attempt.submission.outcome === 'escalate' ? `Escalated to ${attempt.submission.team}` : attempt.submission.outcome === 'pending' ? 'Left pending' : 'Resolved'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {r.sections.map((sec) => (
          <div className="card" key={sec.key}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>{sec.label}</h3>
              <strong>
                {sec.score}/{sec.max}
              </strong>
            </div>
            <div style={{ margin: '8px 0 10px' }}>
              <ProgressBar value={sec.score / sec.max} tone={scoreTone((sec.score / sec.max) * 100)} />
            </div>
            <ul className="check-list">
              {sec.items.map((it, i) => (
                <li key={i}>
                  <span className={it.ok ? 'ok' : 'no'}>{it.ok ? '✓' : '✗'}</span>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {scenario && (
        <div className="grid grid-2">
          <div className="card">
            <h2>Ideal path</h2>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {scenario.solution.map((step, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h2>Why it matters</h2>
            <p>{scenario.debrief}</p>
            <div className="row">
              {scenario.kb
                .filter((k) => KB_BY_ID[k])
                .map((k) => (
                  <Link key={k} to={`/kb/${k}`} className="btn btn-sm">
                    📄 {KB_BY_ID[k].title}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>Your work notes</h3>
          <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
            {attempt.submission.note}
          </p>
          <h3 className="mt">Your reply</h3>
          <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
            {attempt.submission.reply}
          </p>
        </div>
        <div className="card">
          <h3>Timeline</h3>
          <div className="log" style={{ maxHeight: 360 }}>
            {attempt.log.map((l, i) => (
              <div key={i}>
                [{formatClock(l.at)}] {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
