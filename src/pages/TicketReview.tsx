import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  FileText,
  GraduationCap,
  History,
  Hourglass,
  Inbox,
  Info,
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
  Timer,
  TimerOff,
  Wrench,
  X,
  type LucideIcon,
  Sparkles,
} from 'lucide-react';
import { KB_BY_ID } from '../data/kb';
import { HINT_PENALTY } from '../engine/scoring';
import { slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import type { Outcome, ScoreSection, WorkLogEntry } from '../types';
import {
  CategoryPill,
  DifficultyDots,
  EmptyState,
  ModePill,
  PageHeader,
  PriorityPill,
  ProgressBar,
  ScoreRing,
  Stars,
  formatClock,
  formatDateTime,
  scoreTone,
  ticketNumber,
} from '../components/ui';
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

/** Display labels in sentence case (stored attempts keep the grader's original labels). */
const SECTION_LABEL: Partial<Record<ScoreSection['key'], string>> = {
  process: 'Process & security',
  time: 'Handling time',
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

export function TicketReview() {
  const { attemptId } = useParams();
  const { state, getScenario } = useStore();
  const navigate = useNavigate();
  const attempt = state.tickets.find((t) => t.id === attemptId);
  const scenario = attempt ? getScenario(attempt.scenarioId) : undefined;
  const back = state.activeShift ? { to: '/shift', label: 'Shift board' } : { to: '/tickets', label: 'Ticket queue' };

  if (!attempt) {
    return (
      <div className="page review-page">
        <PageHeader
          back={back}
          eyebrow={
            <>
              <Inbox size={14} aria-hidden />
              <span>Practice</span>
            </>
          }
          title="Review not found"
        />
        <div className="card">
          <EmptyState icon={SearchX} title="This attempt isn't in your history">
            <div className="qr-empty-body">
              <span>It may have been cleared, or the link is out of date. Every ticket you close is listed in your ticket history.</span>
              <div className="qr-empty-actions">
                <Link className="btn btn-sm" to="/tickets">
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
    <div className="page review-page">
      <PageHeader
        back={back}
        eyebrow={
          <>
            <Inbox size={14} aria-hidden />
            <span>Practice · {ticketNumber(attempt.scenarioId)}</span>
          </>
        }
        title={attempt.title}
        meta={
          <>
            {scenario && <PriorityPill p={scenario.priority} long />}
            <CategoryPill category={attempt.category} />
            <DifficultyDots d={attempt.difficulty} showLabel />
            <ModePill mode={attempt.mode} />
            <span className="inline-icon">
              <Clock size={14} aria-hidden />
              <span>
                Completed <time dateTime={attempt.completedAt}>{formatDateTime(attempt.completedAt)}</time>
              </span>
            </span>
          </>
        }
        actions={
          state.activeShift ? (
            nextShiftTicket ? (
              <button className="btn btn-primary no-print" onClick={() => navigate(`/ticket/${nextShiftTicket.scenarioId}?mode=shift`)}>
                Next shift ticket
                <ArrowRight size={16} aria-hidden />
              </button>
            ) : undefined
          ) : (
            <>
              <button className="btn print-btn no-print" onClick={() => window.print()}>
                <Printer size={16} aria-hidden />
                Print
              </button>
              <Link className="btn no-print" to={`/ticket/${attempt.scenarioId}`}>
                <RotateCcw size={16} aria-hidden />
                Retry
              </Link>
              <Link className="btn btn-primary no-print" to="/tickets">
                Next ticket
                <ArrowRight size={16} aria-hidden />
              </Link>
            </>
          )
        }
      />

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
              <Sparkles aria-hidden />+{r.xp} XP
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
                    {SECTION_LABEL[sec.key] ?? sec.label}
                  </h3>
                  <span className={`pill pill-${tone} num`}>
                    {sec.score}/{sec.max}
                  </span>
                </div>
                <ProgressBar value={ratio} tone={tone} />
                <ul className="check-list">
                  {sec.items.map((it, i) => (
                    <li key={i}>
                      {it.ok ? <Check size={16} className="ok" role="img" aria-label="Met" /> : <X size={16} className="no" role="img" aria-label="Missed" />}
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
                    <KindIcon size={14} aria-hidden />
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
  );
}
