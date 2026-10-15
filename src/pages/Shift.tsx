import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpWideNarrow,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Gauge,
  History,
  Hourglass,
  Inbox,
  Info,
  ListChecks,
  LogIn,
  LogOut,
  Printer,
  ShieldAlert,
  Smile,
  Sparkles,
  Ticket,
  Timer,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { SHIFT_SLA_MIN, shiftEndsAt, slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import type { Priority, ShiftReport } from '../types';
import {
  DifficultyDots,
  EmptyState,
  IconTile,
  Modal,
  PageHeader,
  PriorityPill,
  StatTile,
  Stars,
  formatClock,
  scoreTone,
  ticketNumber,
  timeAgo,
  useNow,
} from '../components/ui';
import { CategoryIcon } from '../components/icons';
import '../styles/shift-calls.css';

const DURATIONS: { min: number; label: string; desc: string; detail: string; icon: LucideIcon }[] = [
  { min: 15, label: 'Quick shift', desc: '~4 tickets', detail: 'A short run to practise triage under a clock.', icon: Timer },
  { min: 25, label: 'Standard shift', desc: '~7 tickets', detail: 'A realistic mix of priorities arriving over time.', icon: Clock },
  { min: 40, label: 'Full shift', desc: '~11 tickets', detail: 'Sustained load with overlapping SLA windows.', icon: CalendarClock },
];

const PRIORITIES = Object.keys(SHIFT_SLA_MIN) as Priority[];

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
      <div className="sc-page">
        <PageHeader
          eyebrow={
            <>
              <Timer size={14} aria-hidden />
              Shift mode
            </>
          }
          title="Start a shift"
          description="Tickets arrive over time with SLA clocks running. Prioritise, work fast, and keep every ticket inside its SLA."
        />

        <section className="grid grid-3" aria-label="Choose a shift length">
          {DURATIONS.map((d) => (
            <div key={d.min} className="card sc-duration">
              <div className="sc-duration-top">
                <IconTile icon={d.icon} tone="primary" size="lg" />
                <span className="pill pill-outline">
                  <Ticket aria-hidden />
                  {d.desc}
                </span>
              </div>
              <div className="sc-duration-figure">
                <span className="stat-value">{d.min}</span>
                <span className="sc-duration-unit">min</span>
              </div>
              <div>
                <div className="sc-duration-name">{d.label}</div>
                <div className="sc-duration-desc">{d.detail}</div>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'startShift', durationMin: d.min })}>
                <LogIn size={16} aria-hidden />
                Clock in
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>
              <Info size={18} aria-hidden />
              How shifts work
            </h2>
          </div>
          <div className="sc-rules-grid">
            <ul className="sc-rules">
              <Rule icon={Inbox} title="Tickets keep arriving">
                Two tickets are waiting when you clock in; more arrive throughout the shift.
              </Rule>
              <Rule icon={Clock} title="SLA clocks start on arrival">
                Each ticket has an SLA window set by its priority. The clock starts when the ticket arrives.
              </Rule>
              <Rule icon={ArrowUpWideNarrow} title="Work P1s first">
                A breached SLA hurts your shift report even if the fix is perfect.
              </Rule>
              <Rule icon={CircleSlash} title="Unworked means missed">
                Tickets still unworked at the end of the shift count as missed.
              </Rule>
            </ul>
            <div className="sc-sla-windows">
              <span className="label">SLA windows</span>
              <ul className="sc-sla-list">
                {PRIORITIES.map((p) => (
                  <li key={p}>
                    <PriorityPill p={p} long />
                    <span className="sc-sla-min">{SHIFT_SLA_MIN[p]} min</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <ShiftHistory reports={state.shifts} />
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
  const totalTickets = shift.tickets.length + shift.pending.length;
  const atRisk = waiting.filter((x) => {
    const deadline = slaDeadline(x.t.arrivedAt, x.sc.priority);
    const left = deadline - now;
    return left > 0 && left / (deadline - x.t.arrivedAt) < 0.35;
  }).length;
  const outstanding = waiting.length + shift.pending.length;

  const end = () => {
    const r = finishShift();
    setConfirmEnd(false);
    if (r) setReport(r);
  };

  return (
    <div className="sc-page">
      <PageHeader
        eyebrow={
          <>
            <span className="live-dot">LIVE</span>
            Shift mode · {shift.durationMin} min
          </>
        }
        title="Shift board"
        description="Sorted by SLA deadline. The most urgent ticket is on top."
        actions={
          <>
            <span className={`timer ${remaining < 120 ? 'over' : ''}`} role="timer" aria-label="Time left in shift">
              <Timer size={16} aria-hidden />
              {remaining > 0 ? formatClock(remaining) : '00:00'} left
            </span>
            <button className="btn btn-danger" onClick={() => setConfirmEnd(true)}>
              <LogOut size={16} aria-hidden />
              Clock out
            </button>
          </>
        }
      />

      {remaining <= 0 && (
        <div className="callout success" role="status">
          <CircleCheck size={18} aria-hidden />
          <div className="callout-body spread">
            <span>
              <strong>Shift over.</strong> Time to hand over and see how you did.
            </span>
            <button className="btn btn-primary btn-sm" onClick={end}>
              <ClipboardList size={14} aria-hidden />
              View shift report
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-4">
        <StatTile
          label="Waiting"
          value={waiting.length}
          icon={Inbox}
          tone={atRisk > 0 ? 'warning' : 'info'}
          sub={waiting.length === 0 ? 'Queue clear' : atRisk > 0 ? <span className="sc-text-warning">{atRisk} close to breach</span> : 'None close to breach'}
        />
        <StatTile label="Handled" value={done.length} icon={CircleCheck} tone="success" sub={`of ${totalTickets} this shift`} />
        <StatTile
          label="SLA breaches"
          value={breached > 0 ? <span className="sc-text-danger">{breached}</span> : breached}
          icon={ShieldAlert}
          tone={breached > 0 ? 'danger' : 'neutral'}
          sub={breached > 0 ? 'Includes waiting tickets past SLA' : 'All within SLA so far'}
        />
        <StatTile
          label="Incoming"
          value={shift.pending.length}
          icon={Hourglass}
          tone="neutral"
          sub={
            shift.pending.length > 0 && remaining > 0
              ? `Next in ${formatClock(Math.max(0, (shift.nextArrivalAt - now) / 1000))}`
              : shift.pending.length === 0
                ? 'All tickets delivered'
                : undefined
          }
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>
            <Inbox size={18} aria-hidden />
            Queue
          </h2>
          <span className="pill num">{waiting.length} waiting</span>
        </div>
        {waiting.length === 0 ? (
          <EmptyState icon={CircleCheck} title="Queue clear">
            {shift.pending.length ? 'New tickets are on their way.' : 'Nothing else is expected this shift.'}
          </EmptyState>
        ) : (
          <ul className="sc-queue">
            {waiting.map(({ t, sc }) => {
              const deadline = slaDeadline(t.arrivedAt, sc.priority);
              const total = deadline - t.arrivedAt;
              const left = deadline - now;
              const frac = Math.max(0, left / total);
              const tone = left <= 0 ? 'bad' : frac < 0.35 ? 'warn' : '';
              return (
                <li key={t.scenarioId} className={`sc-qrow ${tone}`}>
                  <div className="sc-qrow-main">
                    <div className="sc-qrow-info">
                      <span className="icon-tile tone-neutral size-md" aria-hidden>
                        <CategoryIcon category={sc.category} size={18} />
                      </span>
                      <div className="sc-qrow-text">
                        <span className="sc-qrow-title">{sc.title}</span>
                        <div className="sc-qrow-meta">
                          <PriorityPill p={sc.priority} />
                          <span className="ticket-id">{ticketNumber(sc.id)}</span>
                          <span>{sc.category}</span>
                          <DifficultyDots d={sc.difficulty} />
                        </div>
                      </div>
                    </div>
                    <div className="sc-qrow-actions">
                      <span className={`sc-sla ${tone}`} aria-label={left > 0 ? `SLA time left ${formatClock(left / 1000)}` : 'SLA breached'}>
                        {left > 0 ? <Clock size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
                        {left > 0 ? formatClock(left / 1000) : 'Breached'}
                      </span>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ticket/${sc.id}?mode=shift`)}>
                        Work ticket
                        <ArrowRight size={14} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className={`sla-bar ${tone}`} aria-hidden>
                    <div style={{ width: `${frac * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              <ListChecks size={18} aria-hidden />
              Handled this shift
            </h2>
            <span className="pill num">{done.length} handled</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Score</th>
                  <th>SLA</th>
                  <th>
                    <span className="sc-sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {done.map((t) => {
                  const a = state.tickets.find((x) => x.id === t.attemptId);
                  return (
                    <tr key={t.scenarioId}>
                      <td>
                        <div className="sc-ticket-cell">
                          <strong>{getScenario(t.scenarioId)?.title}</strong>
                          <span className="ticket-id">{ticketNumber(t.scenarioId)}</span>
                        </div>
                      </td>
                      <td>{a && <span className={`pill pill-${scoreTone(a.result.total)}`}>{a.result.total}</span>}</td>
                      <td>
                        {t.slaBreached ? (
                          <span className="pill pill-danger">
                            <CircleAlert aria-hidden />
                            Breached
                          </span>
                        ) : (
                          <span className="pill pill-success">
                            <CircleCheck aria-hidden />
                            Met
                          </span>
                        )}
                      </td>
                      <td>
                        {a && (
                          <Link className="sc-link" to={`/review/${a.id}`}>
                            Review
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {confirmEnd && (
        <Modal title="Clock out now?" onClose={() => setConfirmEnd(false)}>
          <div className="sc-modal-body">
            {outstanding > 0 ? (
              <div className="callout warning">
                <TriangleAlert size={18} aria-hidden />
                <div className="callout-body">{outstanding} ticket(s) will be counted as missed.</div>
              </div>
            ) : (
              <div className="callout success">
                <CircleCheck size={18} aria-hidden />
                <div className="callout-body">All tickets are handled.</div>
              </div>
            )}
            <p className="small muted">Clock out to file a shift report. Discarding ends the shift without a report.</p>
          </div>
          <div className="sc-modal-actions">
            <button className="btn" onClick={() => setConfirmEnd(false)}>
              Keep working
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'abandonShift' });
                setConfirmEnd(false);
              }}
            >
              <Trash2 size={16} aria-hidden />
              Discard shift
            </button>
            <button className="btn btn-primary" onClick={end}>
              <LogOut size={16} aria-hidden />
              Clock out &amp; see report
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Rule({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li>
      <IconTile icon={icon} tone="neutral" size="sm" />
      <div>
        <span className="sc-rule-title">{title}</span>
        <span className="sc-rule-text">{children}</span>
      </div>
    </li>
  );
}

function verdictFor(report: ShiftReport): { title: string; text: string; tone: 'success' | 'warning' | 'danger' } {
  if (report.breaches === 0 && report.missed === 0 && report.avgScore >= 80)
    return { title: 'Outstanding shift', text: 'Every ticket handled within SLA.', tone: 'success' };
  if (report.breaches <= 1 && report.avgScore >= 70) return { title: 'Solid shift', text: 'A few things to tighten up.', tone: 'warning' };
  return { title: 'Tough shift', text: 'Review the debriefs and try again.', tone: 'danger' };
}

function ReportView({ report, onClose }: { report: ShiftReport; onClose: () => void }) {
  const verdict = verdictFor(report);
  const xp = 50 + report.handled * 10;
  return (
    <div className="sc-page">
      <PageHeader
        eyebrow={
          <>
            <ClipboardCheck size={14} aria-hidden />
            Shift report · {report.durationMin} min
          </>
        }
        title={verdict.title}
        description={verdict.text}
        actions={
          <>
            <button className="btn print-btn no-print" onClick={() => window.print()}>
              <Printer size={16} aria-hidden />
              Print
            </button>
            <button className="btn btn-primary no-print" onClick={onClose}>
              <CircleCheck size={16} aria-hidden />
              Done
            </button>
          </>
        }
      />
      <div className="grid grid-4">
        <StatTile
          label="Tickets handled"
          value={report.handled}
          icon={Ticket}
          tone="primary"
          sub={report.missed > 0 ? <span className="sc-text-warning">{report.missed} missed</span> : 'None missed'}
        />
        <StatTile
          label="Average score"
          value={report.handled ? report.avgScore : '–'}
          icon={Gauge}
          tone={report.handled ? scoreTone(report.avgScore) : 'neutral'}
          sub="Across handled tickets"
        />
        <StatTile
          label="Avg. CSAT"
          value={report.handled ? <Stars value={report.avgCsat} size={20} /> : '–'}
          icon={Smile}
          tone="info"
          sub={report.handled ? `${report.avgCsat} / 5` : 'No tickets handled'}
        />
        <StatTile
          label="SLA breaches"
          value={<span className={report.breaches ? 'sc-text-danger' : 'sc-text-success'}>{report.breaches}</span>}
          icon={ShieldAlert}
          tone={report.breaches ? 'danger' : 'success'}
          sub={report.breaches ? 'Tickets past their SLA window' : 'No tickets past SLA'}
        />
      </div>
      <div className="callout info">
        <Sparkles size={18} aria-hidden />
        <div className="callout-body">
          <strong>+{xp} XP</strong> for completing the shift (50 base + 10 per ticket), on top of each ticket's own XP.
        </div>
      </div>
    </div>
  );
}

function ShiftHistory({ reports }: { reports: ShiftReport[] }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <History size={18} aria-hidden />
          Previous shifts
        </h2>
        {reports.length > 0 && <span className="pill num">{reports.length}</span>}
      </div>
      {reports.length === 0 ? (
        <EmptyState icon={History} title="No shifts yet">
          Clock in above. Your shift reports will be listed here.
        </EmptyState>
      ) : (
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
                  <td className="num">{r.durationMin} min</td>
                  <td className="num">{r.handled}</td>
                  <td>{r.handled ? <span className={`pill pill-${scoreTone(r.avgScore)}`}>{r.avgScore}</span> : <span className="faint">–</span>}</td>
                  <td>
                    <span className={`pill ${r.breaches ? 'pill-danger' : 'pill-success'}`}>{r.breaches}</span>
                  </td>
                  <td>
                    <span className={`pill ${r.missed ? 'pill-warning' : 'pill-outline'}`}>{r.missed}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
