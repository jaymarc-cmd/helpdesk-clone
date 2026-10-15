import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  FileText,
  GraduationCap,
  History,
  Hourglass,
  Info,
  LayoutList,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  MessagesSquare,
  MousePointerClick,
  NotebookPen,
  Printer,
  RotateCcw,
  Route,
  ScanSearch,
  SearchX,
  ShieldCheck,
  SquareTerminal,
  Stethoscope,
  Target,
  Timer,
  TimerOff,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { KB_BY_ID } from '../data/kb';
import { HINT_PENALTY } from '../engine/scoring';
import { slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import type { Outcome, ScoreSection, WorkLogEntry } from '../types';
import { EmptyState, PageHeader, ProgressBar, ScoreRing, Stars, formatClock, scoreTone, ticketNumber } from '../components/ui';
import { CategoryIcon } from '../components/icons';
import '../styles/queue-review.css';

const SECTION_ICON: Record<ScoreSection['key'], LucideIcon> = {
  diagnosis: Stethoscope,
  resolution: Wrench,
  investigation: ScanSearch,
  process: ShieldCheck,
  communication: MessagesSquare,
  documentation: FileText,
  time: Clock,
};

const LOG_ICON: Record<WorkLogEntry['kind'], LucideIcon> = {
  question: MessageCircleQuestion,
  action: MousePointerClick,
  terminal: SquareTerminal,
  kb: BookOpen,
  hint: Lightbulb,
  system: Info,
};

const OUTCOME_ICON: Record<Outcome, LucideIcon> = {
  resolve: CircleCheck,
  escalate: ArrowUpRight,
  pending: Hourglass,
};

function formatCompleted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function TicketReview() {
  const { attemptId } = useParams();
  const { state, getScenario } = useStore();
  const navigate = useNavigate();
  const attempt = state.tickets.find((t) => t.id === attemptId);
  const scenario = attempt ? getScenario(attempt.scenarioId) : undefined;

  if (!attempt) {
    return (
      <div>
        <PageHeader eyebrow="Ticket review" title="Review not found" />
        <div className="card">
          <EmptyState icon={SearchX} title="This attempt isn't in your history">
            <div className="qr-empty-body">
              <span>It may have been cleared, or the link is out of date. Every ticket you close is listed in your ticket history.</span>
              <div className="qr-empty-actions">
                <Link className="btn btn-primary btn-sm" to="/tickets">
                  <ArrowLeft size={14} aria-hidden />
                  Back to queue
                </Link>
                <Link className="btn btn-sm" to="/progress">
                  <History size={14} aria-hidden />
                  Ticket history
                </Link>
              </div>
            </div>
          </EmptyState>
        </div>
      </div>
    );
  }

  const r = attempt.result;
  const shiftTicket = state.activeShift?.tickets.find((t) => t.attemptId === attempt.id);
  const nextShiftTicket = state.activeShift?.tickets.find((t) => t.status === 'waiting');
  const rootLabel = scenario?.rootCauses.find((c) => c.id === attempt.submission.rootCause)?.label;
  const diagnosis = r.sections.find((s) => s.key === 'diagnosis');
  const diagnosisCorrect = diagnosis ? diagnosis.score >= diagnosis.max : undefined;
  const outcome = attempt.submission.outcome;
  const OutcomeIcon = OUTCOME_ICON[outcome] ?? CircleCheck;
  const outcomeText = outcome === 'escalate' ? `Escalated to ${attempt.submission.team}` : outcome === 'pending' ? 'Left pending' : 'Resolved';
  const kbIds = scenario ? scenario.kb.filter((k) => KB_BY_ID[k]) : [];
  const note = attempt.submission.note.trim();
  const reply = attempt.submission.reply.trim();
  const checks = r.sections.flatMap((s) => s.items);
  const checksMet = checks.filter((it) => it.ok).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span>Ticket review</span>
            <span className="ticket-id">{ticketNumber(attempt.scenarioId)}</span>
          </>
        }
        title={attempt.title}
        description={
          <span className="review-meta">
            <span>
              <CategoryIcon category={attempt.category} size={14} />
              {attempt.category}
            </span>
            <span>
              {attempt.mode === 'shift' ? <Timer size={14} aria-hidden /> : <Target size={14} aria-hidden />}
              {attempt.mode === 'shift' ? 'Shift ticket' : 'Practice'}
            </span>
            <span>
              <CalendarCheck size={14} aria-hidden />
              <span>
                Completed <time dateTime={attempt.completedAt}>{formatCompleted(attempt.completedAt)}</time>
              </span>
            </span>
          </span>
        }
        actions={
          <div className="page-actions no-print">
            {state.activeShift ? (
              <>
                <Link className="btn" to="/shift">
                  <LayoutList size={16} aria-hidden />
                  Shift board
                </Link>
                {nextShiftTicket && (
                  <button className="btn btn-primary" onClick={() => navigate(`/ticket/${nextShiftTicket.scenarioId}?mode=shift`)}>
                    Next shift ticket
                    <ArrowRight size={16} aria-hidden />
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn btn-ghost print-btn" onClick={() => window.print()}>
                  <Printer size={16} aria-hidden />
                  Print
                </button>
                <Link className="btn" to={`/ticket/${attempt.scenarioId}`}>
                  <RotateCcw size={16} aria-hidden />
                  Retry
                </Link>
                <Link className="btn btn-primary" to="/tickets">
                  Next ticket
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="qr-body">
        <section className="card review-summary" aria-label="Result summary">
          <ScoreRing score={r.total} label={`Grade ${r.grade}`} />
          <div className="review-summary-body">
            <dl className="review-facts">
              <div>
                <dt className="label">Your diagnosis</dt>
                <dd className="review-diagnosis">
                  <strong>{rootLabel ?? 'Not recorded'}</strong>
                  {diagnosisCorrect !== undefined && (
                    <span className={`pill ${diagnosisCorrect ? 'pill-success' : 'pill-danger'}`}>
                      {diagnosisCorrect ? <Check aria-hidden /> : <X aria-hidden />}
                      {diagnosisCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="label">Outcome</dt>
                <dd>
                  <OutcomeIcon size={16} aria-hidden className="review-outcome-icon" />
                  <strong>{outcomeText}</strong>
                </dd>
              </div>
              <div>
                <dt className="label">Customer satisfaction</dt>
                <dd>
                  <Stars value={r.csat} />
                  <span className="muted small num">({r.csat}/5)</span>
                </dd>
              </div>
            </dl>

            <div className="row review-pills">
              <span className="pill pill-primary">
                <Zap aria-hidden />+{r.xp} XP
              </span>
              <span className="pill" title={scenario ? `Handling time (target ${scenario.targetMinutes} min)` : 'Handling time'}>
                <Clock aria-hidden />
                {formatClock(attempt.durationSec)}
              </span>
              {attempt.hintsUsed > 0 && (
                <span className="pill pill-warning">
                  <Lightbulb aria-hidden />
                  {attempt.hintsUsed} hint{attempt.hintsUsed > 1 ? 's' : ''} (−{attempt.hintsUsed * HINT_PENALTY})
                </span>
              )}
              {shiftTicket && scenario && (
                <span className={`pill ${shiftTicket.slaBreached ? 'pill-danger' : 'pill-success'}`}>
                  {shiftTicket.slaBreached ? <TimerOff aria-hidden /> : <Timer aria-hidden />}
                  SLA {shiftTicket.slaBreached ? 'breached' : 'met'} ({formatClock((slaDeadline(shiftTicket.arrivedAt, scenario.priority) - shiftTicket.arrivedAt) / 1000)})
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="card review-breakdown" aria-labelledby="review-breakdown-h">
          <div className="card-head">
            <h2 id="review-breakdown-h">
              <ListChecks size={18} aria-hidden />
              Score breakdown
            </h2>
            <span className="pill num">
              {checksMet} of {checks.length} checks met
            </span>
          </div>
          <div className="review-sections">
            {r.sections.map((sec) => {
              const Icon = SECTION_ICON[sec.key] ?? CircleCheck;
              const ratio = sec.max ? sec.score / sec.max : 0;
              const tone = scoreTone(ratio * 100);
              return (
                <section className="review-section" key={sec.key} aria-labelledby={`review-sec-${sec.key}`}>
                  <div className="review-section-head">
                    <h3 id={`review-sec-${sec.key}`}>
                      <Icon size={16} aria-hidden />
                      {sec.label}
                    </h3>
                    <span className={`pill pill-${tone} num`}>
                      {sec.score}/{sec.max}
                    </span>
                  </div>
                  <ProgressBar value={ratio} tone={tone} />
                  <ul className="check-list">
                    {sec.items.map((it, i) => (
                      <li key={i}>
                        {it.ok ? <Check size={15} className="ok" role="img" aria-label="Met" /> : <X size={15} className="no" role="img" aria-label="Missed" />}
                        <span>{it.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>

        {scenario && (
          <div className="grid grid-2">
            <section className="card">
              <div className="card-head">
                <h2>
                  <Route size={18} aria-hidden />
                  Ideal path
                </h2>
                <span className="pill num">
                  {scenario.solution.length} step{scenario.solution.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="review-steps" role="list">
                {scenario.solution.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>
                  <GraduationCap size={18} aria-hidden />
                  Why it matters
                </h2>
              </div>
              <div className="stack">
                <p className="review-prose">{scenario.debrief}</p>
                {kbIds.length > 0 && (
                  <div className="review-block">
                    <div className="label">Related knowledge base articles</div>
                    <ul className="review-kb">
                      {kbIds.map((k) => (
                        <li key={k}>
                          <Link to={`/kb/${k}`}>
                            <FileText size={16} aria-hidden />
                            <span>{KB_BY_ID[k].title}</span>
                            <ChevronRight size={16} aria-hidden className="review-kb-chev" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="grid grid-2">
          <section className="card">
            <div className="card-head">
              <h2>
                <NotebookPen size={18} aria-hidden />
                Your submission
              </h2>
            </div>
            <div className="stack review-submission">
              <div className="review-block">
                <div className="label">Work notes</div>
                <p className={`review-quote${note ? '' : ' is-empty'}`}>{note ? attempt.submission.note : 'No work notes were written.'}</p>
              </div>
              <div className="review-block">
                <div className="label">Reply to requester</div>
                <p className={`review-quote${reply ? '' : ' is-empty'}`}>{reply ? attempt.submission.reply : 'No reply was sent to the requester.'}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                <History size={18} aria-hidden />
                Timeline
              </h2>
              <span className="pill num">
                {attempt.log.length} event{attempt.log.length === 1 ? '' : 's'}
              </span>
            </div>
            {attempt.log.length > 0 ? (
              <ol className="log review-log" role="list">
                {attempt.log.map((l, i) => {
                  const KindIcon = LOG_ICON[l.kind] ?? Info;
                  return (
                    <li key={i} className={`kind-${l.kind}`}>
                      <span className="t">{formatClock(l.at)}</span>
                      <KindIcon size={13} aria-hidden />
                      <span className="review-log-text">{l.text}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={History} title="No activity recorded" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
