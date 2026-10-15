import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SHIFT_SLA_MIN, shiftEndsAt, slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import type { ShiftReport } from '../types';
import { DifficultyDots, Modal, PriorityPill, Stars, formatClock, scoreTone, timeAgo, useNow } from '../components/ui';

const DURATIONS = [
  { min: 15, label: 'Quick shift', desc: '~4 tickets' },
  { min: 25, label: 'Standard shift', desc: '~7 tickets' },
  { min: 40, label: 'Full shift', desc: '~11 tickets' },
];

export function ShiftPage() {
  const { state, dispatch, getScenario, finishShift } = useStore();
  const navigate = useNavigate();
  const now = useNow();
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const shift = state.activeShift;

  if (report) return <ReportView report={report} onClose={() => setReport(null)} />;

  if (!shift) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div className="page-head">
          <div>
            <h1>Shift Mode</h1>
            <p>Tickets arrive over time with SLA clocks running. Prioritise, work fast, and don't let anything breach.</p>
          </div>
        </div>
        <div className="grid grid-3">
          {DURATIONS.map((d) => (
            <div key={d.min} className="card stack">
              <div className="stat">
                <span className="value">{d.min} min</span>
                <span className="label">
                  {d.label} · {d.desc}
                </span>
              </div>
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'startShift', durationMin: d.min })}>
                Clock in
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>How shifts work</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Two tickets are waiting when you clock in; more arrive throughout the shift.</li>
            <li>
              SLA windows by priority: {Object.entries(SHIFT_SLA_MIN).map(([p, m]) => `${p} ${m} min`).join(' · ')}. The clock starts when a ticket arrives.
            </li>
            <li>Work P1s first. A breached SLA hurts your shift report even if the fix is perfect.</li>
            <li>Unworked tickets at the end of the shift count as missed.</li>
          </ul>
        </div>
        {state.shifts.length > 0 && <ShiftHistory reports={state.shifts} />}
      </div>
    );
  }

  const endsAt = shiftEndsAt(shift);
  const remaining = (endsAt - now) / 1000;
  const waiting = shift.tickets
    .filter((t) => t.status === 'waiting')
    .map((t) => ({ t, sc: getScenario(t.scenarioId)! }))
    .filter((x) => x.sc)
    .sort((a, b) => slaDeadline(a.t.arrivedAt, a.sc.priority) - slaDeadline(b.t.arrivedAt, b.sc.priority));
  const done = shift.tickets.filter((t) => t.status === 'done');
  const breached = done.filter((t) => t.slaBreached).length + waiting.filter((x) => now > slaDeadline(x.t.arrivedAt, x.sc.priority)).length;

  const end = () => {
    const r = finishShift();
    setConfirmEnd(false);
    if (r) setReport(r);
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>
            Shift board <span className="pill pill-danger">LIVE</span>
          </h1>
          <p>Sorted by SLA deadline. The most urgent ticket is on top.</p>
        </div>
        <div className="row">
          <span className={`timer ${remaining < 120 ? 'over' : ''}`}>⏱ {remaining > 0 ? formatClock(remaining) : '00:00'} left</span>
          <button className="btn btn-danger" onClick={() => setConfirmEnd(true)}>
            Clock out
          </button>
        </div>
      </div>

      {remaining <= 0 && (
        <div className="callout success spread">
          <span>
            <strong>Shift over!</strong> Time to hand over and see how you did.
          </span>
          <button className="btn btn-primary" onClick={end}>
            View shift report
          </button>
        </div>
      )}

      <div className="grid grid-4">
        <div className="card stat">
          <span className="value">{waiting.length}</span>
          <span className="label">Waiting</span>
        </div>
        <div className="card stat">
          <span className="value">{done.length}</span>
          <span className="label">Handled</span>
        </div>
        <div className="card stat">
          <span className="value" style={{ color: breached ? 'var(--danger)' : undefined }}>
            {breached}
          </span>
          <span className="label">SLA breaches</span>
        </div>
        <div className="card stat">
          <span className="value">{shift.pending.length}</span>
          <span className="label">
            Incoming
            {shift.pending.length > 0 && remaining > 0 && ` · next in ${formatClock(Math.max(0, (shift.nextArrivalAt - now) / 1000))}`}
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Queue</h2>
        {waiting.length === 0 ? (
          <div className="empty">{shift.pending.length ? 'Queue clear! New tickets are on their way…' : 'Queue clear. Nothing else is expected this shift.'}</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {waiting.map(({ t, sc }) => {
              const deadline = slaDeadline(t.arrivedAt, sc.priority);
              const total = deadline - t.arrivedAt;
              const left = deadline - now;
              const frac = Math.max(0, left / total);
              const tone = left <= 0 ? 'bad' : frac < 0.35 ? 'warn' : '';
              return (
                <div key={t.scenarioId} className="card card-tight">
                  <div className="spread">
                    <div className="row">
                      <PriorityPill p={sc.priority} />
                      <span className="pill">{sc.category}</span>
                      <strong>{sc.title}</strong>
                      <DifficultyDots d={sc.difficulty} />
                    </div>
                    <div className="row">
                      <span className={`small ${left <= 0 ? '' : 'muted'}`} style={{ color: left <= 0 ? 'var(--danger)' : undefined, fontWeight: left <= 0 ? 700 : 400 }}>
                        {left > 0 ? `SLA ${formatClock(left / 1000)}` : 'SLA BREACHED'}
                      </span>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ticket/${sc.id}?mode=shift`)}>
                        Work ticket
                      </button>
                    </div>
                  </div>
                  <div className={`sla-bar ${tone}`} style={{ marginTop: 8 }}>
                    <div style={{ width: `${frac * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="card">
          <h2>Handled this shift</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Score</th>
                  <th>SLA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {done.map((t) => {
                  const a = state.tickets.find((x) => x.id === t.attemptId);
                  return (
                    <tr key={t.scenarioId}>
                      <td>{getScenario(t.scenarioId)?.title}</td>
                      <td>{a && <span className={`pill pill-${scoreTone(a.result.total)}`}>{a.result.total}</span>}</td>
                      <td>{t.slaBreached ? <span className="pill pill-danger">Breached</span> : <span className="pill pill-success">Met</span>}</td>
                      <td>{a && <Link to={`/review/${a.id}`}>Review</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmEnd && (
        <Modal onClose={() => setConfirmEnd(false)}>
          <h2>Clock out now?</h2>
          <p>
            {waiting.length + shift.pending.length > 0
              ? `${waiting.length + shift.pending.length} ticket(s) will be counted as missed.`
              : 'All tickets handled. Nice work!'}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmEnd(false)}>
              Keep working
            </button>
            <button className="btn btn-danger" onClick={() => { dispatch({ type: 'abandonShift' }); setConfirmEnd(false); }}>
              Discard shift
            </button>
            <button className="btn btn-primary" onClick={end}>
              Clock out &amp; see report
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReportView({ report, onClose }: { report: ShiftReport; onClose: () => void }) {
  const verdict =
    report.breaches === 0 && report.missed === 0 && report.avgScore >= 80
      ? 'Outstanding shift: every ticket handled within SLA.'
      : report.breaches <= 1 && report.avgScore >= 70
        ? 'Solid shift. A few things to tighten up.'
        : 'Tough shift. Review the debriefs and try again.';
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Shift report</h1>
          <p>{verdict}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => window.print()}>
            🖨 Print
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <div className="grid grid-4">
        <div className="card stat">
          <span className="value">{report.handled}</span>
          <span className="label">Tickets handled</span>
        </div>
        <div className="card stat">
          <span className="value">{report.handled ? report.avgScore : '–'}</span>
          <span className="label">Average score</span>
        </div>
        <div className="card stat">
          <span className="value">{report.handled ? <Stars value={report.avgCsat} /> : '–'}</span>
          <span className="label">Avg. CSAT</span>
        </div>
        <div className="card stat">
          <span className="value" style={{ color: report.breaches ? 'var(--danger)' : 'var(--success)' }}>
            {report.breaches}
          </span>
          <span className="label">SLA breaches · {report.missed} missed</span>
        </div>
      </div>
      <div className="callout">
        +{50 + report.handled * 10} XP for completing the shift (50 base + 10 per ticket), on top of each ticket's own XP.
      </div>
    </div>
  );
}

function ShiftHistory({ reports }: { reports: ShiftReport[] }) {
  return (
    <div className="card">
      <h3>Previous shifts</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Length</th>
              <th>Handled</th>
              <th>Avg score</th>
              <th>Breaches</th>
              <th>Missed</th>
            </tr>
          </thead>
          <tbody>
            {[...reports].reverse().map((r) => (
              <tr key={r.id}>
                <td>{timeAgo(r.completedAt)}</td>
                <td>{r.durationMin} min</td>
                <td>{r.handled}</td>
                <td>{r.handled ? r.avgScore : '–'}</td>
                <td>{r.breaches}</td>
                <td>{r.missed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
