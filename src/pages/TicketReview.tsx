import { useState } from 'react';
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
  Forward,
  History,
  Hourglass,
  Info,
  Lightbulb,
  type LucideIcon,
  MessageCircleQuestion,
  MousePointerClick,
  PenLine,
  Printer,
  RotateCcw,
  SearchX,
  Sparkles,
  SquareTerminal,
  StickyNote,
  Timer,
  TimerOff,
  X,
} from 'lucide-react';
import { KB_BY_ID } from '../data/kb';
import { handoffVerdict } from '../engine/followup';
import { HINT_PENALTY } from '../engine/scoring';
import { slaDeadline } from '../engine/shift';
import { useStore } from '../state/store';
import type { Outcome, Scenario, ScoreSection, WorkLogEntry } from '../types';
import {
  CategoryPill,
  DifficultyDots,
  EmptyState,
  Modal,
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
import '../styles/workstation.css';
import { loggedPriority } from '../engine/triage';

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
  note: StickyNote,
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
  const handoff = attempt && scenario ? handoffVerdict(scenario, attempt) : undefined;
  const requesterName = scenario?.requester.name.split(' ')[0] ?? 'Requester';
  const back =
    attempt?.mode === 'exam'
      ? { to: '/certification', label: 'Certification' }
      : state.activeShift
        ? { to: '/shift', label: 'Shift board' }
        : { to: '/tickets', label: 'Ticket queue' };

  if (!attempt) {
    return (
      <div className="page review-page">
        <PageHeader
          back={back}
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
        title={attempt.title}
        meta={
          <>
            <span className="mono meta-id">{ticketNumber(attempt.scenarioId)}</span>
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

      {attempt.reopenReason && (
        <div className="callout warning">
          <RotateCcw size={18} aria-hidden />
          <div className="callout-body">
            <strong>This resolution won't hold.</strong> {attempt.reopenReason} The ticket comes back to your queue as reopened in a few minutes.
          </div>
        </div>
      )}
      {handoff && (
        <div className={`callout ${handoff.verdict === 'accepted' ? 'success' : 'warning'}`}>
          <Forward size={18} aria-hidden />
          <div className="callout-body">
            <strong>{handoff.verdict === 'accepted' ? 'Hand-off accepted.' : handoff.verdict === 'reassigned' ? 'Hand-off bounced.' : 'Hand-off returned.'}</strong> {handoff.message}
          </div>
        </div>
      )}
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
                SLA {shiftTicket.slaBreached ? 'breached' : 'met'} ({formatClock((slaDeadline(shiftTicket.arrivedAt, shiftTicket.priority ?? loggedPriority(scenario)) - shiftTicket.arrivedAt) / 1000)})
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="card review-breakdown" aria-labelledby="review-breakdown-h">
        <div className="card-head">
          <h2 id="review-breakdown-h">
            Score breakdown
          </h2>
          <span className="pill num">
            {checksMet} of {checks.length} checks met
          </span>
        </div>
        <div className="review-sections">
          {r.sections.map((sec) => {
            const ratio = sec.max ? sec.score / sec.max : 0;
            const tone = scoreTone(ratio * 100);
            return (
              <section className="review-section" key={sec.key} aria-labelledby={`review-sec-${sec.key}`}>
                <div className="review-section-head">
                  <h3 id={`review-sec-${sec.key}`}>
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

      {scenario && <KbWriter attemptId={attempt.id} scenario={scenario} ticket={ticketNumber(attempt.scenarioId)} />}

      {attempt.transcript && attempt.transcript.length > 0 && (
        <section className="card" aria-labelledby="review-transcript-h">
          <div className="card-head">
            <h2 id="review-transcript-h">Conversation</h2>
            <span className="pill num">
              {attempt.transcript.filter((m) => m.from === 'agent').length} messages from you
            </span>
          </div>
          <div className="chat wk-chat review-transcript">
            {attempt.transcript.map((m, i) =>
              m.from === 'system' ? (
                <div key={i} className="msg system">
                  {m.text}
                </div>
              ) : m.from === 'note' ? (
                <div key={i} className="wk-note">
                  <span className="wk-note-head">Internal note · {formatClock(m.at ?? 0)}</span>
                  {m.text}
                </div>
              ) : (
                <div key={i} className={`wk-row ${m.from} first`}>
                  <div className="wk-bubble-col">
                    <div className={`msg ${m.from}`}>{m.text.replace(/^\[Guided step\] /, 'Asked the user to: ')}</div>
                    <span className="wk-meta">
                      {m.from === 'agent' ? 'You' : requesterName} · {formatClock(m.at ?? 0)}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Turn a solved ticket into a knowledge base article for the next analyst. */
function KbWriter({ attemptId, scenario, ticket }: { attemptId: string; scenario: Scenario; ticket: string }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const id = `kb-mine-${attemptId}`;
  const existing = state.customKb.find((a) => a.id === id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(scenario.title);
  const [symptoms, setSymptoms] = useState('');
  const [cause, setCause] = useState('');
  const [fix, setFix] = useState('');
  const ready = title.trim().length > 5 && symptoms.trim().length > 10 && cause.trim().length > 5 && fix.trim().length > 10;
  return (
    <section className="card review-kb">
      <div className="card-head">
        <h2>Share what you learned</h2>
      </div>
      {existing ? (
        <p>
          You wrote <Link to={`/kb/${existing.id}`}>{existing.title}</Link> from this ticket. It is in the knowledge base for the next analyst.
        </p>
      ) : (
        <div className="row">
          <p className="muted">Unusual fix? Write it up as a knowledge base article so the next analyst solves it faster.</p>
          <button className="btn" onClick={() => setOpen(true)}>
            <PenLine size={16} aria-hidden />
            Write a KB article
          </button>
        </div>
      )}
      {open && (
        <Modal title="New knowledge base article" onClose={() => setOpen(false)}>
          <div className="stack">
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>Symptoms (what the user sees)</span>
              <textarea rows={3} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
            </label>
            <label className="field">
              <span>Cause</span>
              <textarea rows={2} value={cause} onChange={(e) => setCause(e.target.value)} />
            </label>
            <label className="field">
              <span>Resolution steps</span>
              <textarea rows={4} value={fix} onChange={(e) => setFix(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!ready}
                onClick={() => {
                  dispatch({
                    type: 'addKb',
                    article: {
                      id,
                      title: title.trim(),
                      category: scenario.category,
                      tags: [scenario.category.toLowerCase(), 'written by you'],
                      body: `## Symptoms\n\n${symptoms.trim()}\n\n## Cause\n\n${cause.trim()}\n\n## Resolution\n\n${fix.trim()}\n\n_From ${ticket}._`,
                      custom: { fromTicket: ticket, writtenAt: new Date().toISOString() },
                    },
                  });
                  setOpen(false);
                  navigate(`/kb/${id}`);
                }}
              >
                Publish article
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
