import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Clock,
  Compass,
  Crown,
  FileText,
  Fingerprint,
  Hourglass,
  IdCard,
  Info,
  Lightbulb,
  Link2,
  ListChecks,
  type LucideIcon,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareText,
  MonitorSmartphone,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  SearchX,
  Send,
  Server,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  SquareTerminal,
  StickyNote,
  ThumbsUp,
  Timer,
  Wrench,
  X,
} from 'lucide-react';
import { actionsForTool } from '../data/actions';
import { KB_BY_ID } from '../data/kb';
import { HINT_PENALTY, firstResponseTarget, gradeTicket } from '../engine/scoring';
import { reopenReason } from '../engine/followup';
import { nextHint, type ChatMessage, type SessionState } from '../engine/session';
import { MAX_OPEN_TICKETS, useStore, type Work } from '../state/store';
import { uid } from '../state/storage';
import { CATEGORIES, HOLD_REASONS, LEVELS, TEAMS, type Category, type HoldReason, type Level, type Outcome, type Scenario, type Team, type TicketAttempt, type WorkLogEntry } from '../types';
import {
  BestScorePill,
  CategoryPill,
  DifficultyDots,
  EmptyState,
  Modal,
  ModePill,
  PageHeader,
  PriorityPill,
  formatClock,
  initials,
  ticketNumber,
} from '../components/ui';
import { CHANNEL_LABEL, ChannelIcon } from '../components/icons';
import { ActionList, useElapsed } from '../components/work';
import { moodLabel } from '../engine/chat';
import '../styles/workspace.css';
import '../styles/workstation.css';
import { IMPACT_HELP, URGENCY_HELP, currentPriority, loggedPriority, triagedPriority, type Triage } from '../engine/triage';

const LOG_ICON: Record<WorkLogEntry['kind'], LucideIcon> = {
  question: MessageCircleQuestion,
  action: Wrench,
  terminal: SquareTerminal,
  kb: BookOpen,
  hint: Lightbulb,
  system: Info,
  note: StickyNote,
};

const OUTCOMES: { id: Outcome; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'resolve', label: 'Resolved', desc: 'Fixed at tier 1', icon: CircleCheck },
  { id: 'escalate', label: 'Escalate', desc: 'Assign to another team', icon: ArrowUpRight },
  { id: 'pending', label: 'Pending', desc: 'Waiting on the user', icon: Hourglass },
];

const GUIDED_PREFIX = '[Guided step] ';

export function TicketPage() {
  const { id = '' } = useParams();
  const { getScenario, works, state, dispatch } = useStore();
  const scenario = getScenario(id);
  const assigned = works.find((w) => w.scenario.id === id);
  // Opening one of your tickets makes it the one the workstation apps act on.
  useEffect(() => {
    if (assigned && state.focusedWork !== id) dispatch({ type: 'focusWork', scenarioId: id });
  }, [assigned, id, state.focusedWork, dispatch]);
  if (!scenario) {
    return (
      <div className="page ws-root">
        <PageHeader
          back={{ to: '/tickets', label: 'Ticket queue' }}
          title="Ticket not found"
        />
        <div className="card">
          <EmptyState icon={SearchX} title="This ticket isn't in the queue">
            <Link to="/tickets" className="btn btn-sm">
              <ArrowLeft size={14} aria-hidden />
              Back to queue
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }
  if (assigned) return <AssignedTicket key={scenario.id} work={assigned} />;
  return <UnassignedTicket key={scenario.id} scenario={scenario} />;
}

function TicketMeta({ scenario, mode, triage }: { scenario: Scenario; mode?: 'practice' | 'shift' | 'exam'; triage?: Triage }) {
  return (
    <>
      <PriorityPill p={currentPriority(scenario, triage)} long />
      <CategoryPill category={scenario.category} />
      <span className="pill">
        <ChannelIcon channel={scenario.channel} />
        {CHANNEL_LABEL[scenario.channel]}
      </span>
      <DifficultyDots d={scenario.difficulty} showLabel />
      {mode && mode !== 'practice' && <ModePill mode={mode} />}
    </>
  );
}

// ---------------- Not yet assigned ----------------

function UnassignedTicket({ scenario }: { scenario: Scenario }) {
  const { state, works, dispatch } = useStore();
  const [params] = useSearchParams();
  const full = works.length >= MAX_OPEN_TICKETS;
  const reopenId = params.get('reopen');
  const reopen = reopenId ? state.reopens.find((r) => r.attemptId === reopenId && r.scenarioId === scenario.id && r.dueAt <= Date.now()) : undefined;
  const inShift =
    params.get('mode') === 'shift' && !!state.activeShift?.tickets.some((t) => t.scenarioId === scenario.id && t.status === 'waiting');
  const best = state.tickets.filter((t) => t.scenarioId === scenario.id).reduce<number | null>((m, t) => Math.max(m ?? 0, t.result.total), null);
  const r = scenario.requester;

  const assign = () => {
    dispatch({
      type: 'startWork',
      scenarioId: scenario.id,
      mode: inShift ? 'shift' : 'practice',
      now: Date.now(),
      reopen: reopen ? { attemptId: reopen.attemptId, ticket: ticketNumber(scenario.id) } : undefined,
    });
  };

  return (
    <div className="page ws-root wk-ticket">
      <PageHeader
        back={inShift ? { to: '/shift', label: 'Shift board' } : { to: '/tickets', label: 'Ticket queue' }}
        title={scenario.title}
        meta={
          <>
            <span className="mono meta-id">{ticketNumber(scenario.id)}</span>
            <span className="pill pill-outline">
              <CircleDot aria-hidden />
              New
            </span>
            <TicketMeta scenario={scenario} mode={inShift ? 'shift' : undefined} />
            {best !== null && <BestScorePill score={best} />}
          </>
        }
      />

      <div className="wk-ticket-grid">
        <div className="wk-ticket-main">
          <section className="card">
            <div className="card-head">
              <h2>
                Request
              </h2>
              <span className="pill">
                <ChannelIcon channel={scenario.channel} />
                via {CHANNEL_LABEL[scenario.channel].toLowerCase()}
              </span>
            </div>
            <div className="wk-request">
              <div className="avatar" aria-hidden>
                {initials(r.name)}
              </div>
              <div className="wk-request-body">
                <div className="wk-request-from">
                  <strong>{r.name}</strong> <span className="muted">· {r.title}</span>
                </div>
                <p>{scenario.description}</p>
              </div>
            </div>
          </section>

          {reopen && (
            <div className="callout warning">
              <RotateCcw size={18} aria-hidden />
              <div className="callout-body">
                <strong>Reopened.</strong> {reopen.reason} <Link to={`/review/${reopen.attemptId}`}>See the earlier attempt</Link>.
              </div>
            </div>
          )}
          <section className="card wk-assign">
            {full ? (
              <>
                <div className="callout warning">
                  <Info size={18} aria-hidden />
                  <div className="callout-body">
                    You already have {MAX_OPEN_TICKETS} open tickets. Resolve one, or release it back to the queue, before taking another.
                  </div>
                </div>
                <div className="row">
                  {works.map((w) => (
                    <Link key={w.scenario.id} className="btn" to={`/ticket/${w.scenario.id}`}>
                      {ticketNumber(w.scenario.id)}
                      {w.hold ? ' (on hold)' : ''}
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2>Pick up this ticket</h2>
                  <p className="muted">
                    Assigning it to yourself starts the clock (target {scenario.targetMinutes} min). Work it from the conversation and the
                    workstation apps: Directory, Server room, Remote desktop and Deployment. Resolve it when the fix is confirmed.
                    {works.length > 0 &&
                      ` You have ${works.length} other open ticket${works.length > 1 ? 's' : ''}; their requesters keep waiting while you work this one, so put them on hold if you need to.`}
                  </p>
                </div>
                <button className="btn btn-primary btn-lg" onClick={assign}>
                  <Play size={16} aria-hidden />
                  Assign to me and start
                </button>
              </>
            )}
          </section>
        </div>

        <aside className="wk-ticket-side">
          <RequesterCard scenario={scenario} />
        </aside>
      </div>

    </div>
  );
}

// ---------------- Assigned ----------------

function AssignedTicket({ work }: { work: Work }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const sc = work.scenario;
  const s = work.session;
  const elapsed = useElapsed(work.startedAt);
  const [hint, setHint] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdReason, setHoldReason] = useState<HoldReason>('Awaiting user');
  const over = elapsed > sc.targetMinutes * 60;

  const showHint = () => {
    const text = nextHint(sc, s);
    setHint(text);
    work.emit({ type: 'hint', text });
  };

  const submit = (sub: { rootCause: string; outcome: Outcome; team?: Team; note: string; reply: string }) => {
    const durationSec = Math.round((Date.now() - work.startedAt) / 1000);
    const result = gradeTicket(sc, s, sub, durationSec);
    const attempt: TicketAttempt = {
      id: uid('t'),
      scenarioId: sc.id,
      title: sc.title,
      category: sc.category,
      difficulty: sc.difficulty,
      mode: work.mode,
      completedAt: new Date().toISOString(),
      durationSec,
      result,
      submission: sub,
      log: [
        ...s.log,
        {
          at: durationSec,
          kind: 'system',
          text: `Ticket ${sub.outcome === 'escalate' ? `escalated to ${sub.team}` : sub.outcome === 'pending' ? 'set to pending' : 'resolved'}`,
        },
      ],
      hintsUsed: s.hintsUsed,
      transcript: s.chat,
      reopenOf: s.reopenOf,
      reopenReason: reopenReason(sc, s, sub.outcome, sub.rootCause),
    };
    dispatch({ type: 'addTicket', attempt });
    navigate(`/review/${attempt.id}`, { replace: true });
  };

  return (
    <div className="page ws-root wk-ticket">
      <PageHeader
        back={work.mode === 'shift' ? { to: '/shift', label: 'Shift board' } : { to: '/tickets', label: 'Ticket queue' }}
        title={sc.title}
        meta={
          <>
            <span className="mono meta-id">{ticketNumber(sc.id)}</span>
            <span className="pill pill-info">
              <Timer aria-hidden />
              In progress
            </span>
            <TicketMeta scenario={sc} mode={work.mode} triage={s.triage} />
          </>
        }
        actions={
          <>
            {state.settings.hints && (
              <button className="btn" onClick={showHint} title={`Costs ${HINT_PENALTY} points`}>
                <Lightbulb size={16} aria-hidden />
                Hint (−{HINT_PENALTY})
              </button>
            )}
            {work.hold ? (
              <button className="btn" onClick={() => dispatch({ type: 'resumeWork', scenarioId: sc.id, now: Date.now() })}>
                <Play size={16} aria-hidden />
                Resume
              </button>
            ) : (
              <button className="btn" onClick={() => setHolding(true)} title="Pause the clock while you wait on someone">
                <Pause size={16} aria-hidden />
                On hold
              </button>
            )}
            <span className={`timer ${over ? 'over' : ''}`} title={`Target: ${sc.targetMinutes} min`} role="timer">
              <Timer size={16} aria-hidden />
              {work.hold ? 'Paused' : formatClock(elapsed)}
            </span>
            <button className="btn btn-primary" onClick={() => setResolving(true)}>
              <ClipboardCheck size={16} aria-hidden />
              Resolve ticket
            </button>
          </>
        }
      />

      {work.hold && (
        <div className="callout info" role="status">
          <Pause size={18} aria-hidden />
          <div className="callout-body">
            <strong>On hold: {work.hold.reason}.</strong> The clock is paused.{' '}
            {work.hold.reason === 'Awaiting user'
              ? `${sc.requester.name.split(' ')[0]} will reply when they're back, and the ticket comes back to you then.`
              : 'Resume when you have what you were waiting for.'}
          </div>
        </div>
      )}

      {hint && (
        <div className="callout warning" role="status">
          <Lightbulb size={18} aria-hidden />
          <div className="callout-body">
            <strong>Hint.</strong> {hint}
          </div>
          <button className="icon-btn" onClick={() => setHint(null)} aria-label="Dismiss hint">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="wk-ticket-grid">
        <div className="wk-ticket-main">
          <Conversation work={work} />
        </div>
        <aside className="wk-ticket-side">
          <TicketDetailsCard work={work} />
          {sc.related?.length ? <RelatedTicketsCard work={work} /> : null}
          <ToolsCard work={work} />
          <RequesterCard scenario={sc} s={s} />
          <FindingsCard scenario={sc} s={s} />
          <RelatedKbCard scenario={sc} s={s} />
          <ActivityCard s={s} />
          <button className="btn btn-ghost btn-sm wk-release" onClick={() => setReleasing(true)}>
            Release ticket back to the queue
          </button>
        </aside>
      </div>

      {resolving && (
        <Modal title={`Resolve ${ticketNumber(sc.id)}`} onClose={() => setResolving(false)}>
          <ResolveForm scenario={sc} s={s} onSubmit={submit} />
        </Modal>
      )}
      {holding && (
        <Modal title={`Put ${ticketNumber(sc.id)} on hold`} onClose={() => setHolding(false)}>
          <p className="muted">The handling clock pauses while the ticket is on hold. Tell {sc.requester.name.split(' ')[0]} what you are waiting for first.</p>
          <fieldset className="ws-fieldset">
            <legend className="ws-legend">Reason</legend>
            {HOLD_REASONS.map((r) => (
              <label key={r} className="radio-row">
                <input type="radio" name="hold-reason" checked={holdReason === r} onChange={() => setHoldReason(r)} />
                <span>
                  {r}
                  <span className="tiny muted">
                    {' · '}
                    {r === 'Awaiting user' ? 'they need to do or check something; they will reply' : r === 'Awaiting approval' ? 'a manager or data owner must approve' : 'a supplier or another team is involved'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="modal-actions">
            <button className="btn" onClick={() => setHolding(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'holdWork', scenarioId: sc.id, reason: holdReason, now: Date.now() });
                setHolding(false);
              }}
            >
              <Pause size={16} aria-hidden />
              Put on hold
            </button>
          </div>
        </Modal>
      )}
      {releasing && (
        <Modal title="Release this ticket?" onClose={() => setReleasing(false)}>
          <p>Your progress is discarded and the ticket goes back to the queue unscored.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setReleasing(false)} autoFocus>
              Keep working
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'releaseWork', scenarioId: sc.id });
                navigate(work.mode === 'shift' ? '/shift' : '/tickets');
              }}
            >
              Release ticket
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** The ticket record's fields. Triage is part of the job: category, impact and urgency set the priority. */
function TicketDetailsCard({ work }: { work: Work }) {
  const sc = work.scenario;
  const t = work.session.triage ?? {};
  const ids = useId();
  const p = triagedPriority(t);
  const logged = loggedPriority(sc);
  const set = (patch: Triage) => work.emit({ type: 'triage', patch });
  const untriaged = !t.category || !p;
  return (
    <section className="card wk-details" aria-labelledby={`${ids}-h`}>
      <div className="card-head">
        <h3 id={`${ids}-h`}>Ticket details</h3>
        {untriaged ? <span className="pill pill-warning">Needs triage</span> : <span className="pill pill-success">Triaged</span>}
      </div>
      <dl className="kv wk-details-kv">
        <dt>Number</dt>
        <dd className="mono">{ticketNumber(sc.id)}</dd>
        <dt>State</dt>
        <dd>In progress</dd>
        <dt>
          <label htmlFor={`${ids}-cat`}>Category</label>
        </dt>
        <dd>
          <select id={`${ids}-cat`} value={t.category ?? ''} onChange={(e) => set({ category: e.target.value as Category })}>
            <option value="">Select…</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </dd>
        <dt>
          <label htmlFor={`${ids}-imp`}>Impact</label>
        </dt>
        <dd>
          <select id={`${ids}-imp`} value={t.impact ?? ''} onChange={(e) => set({ impact: e.target.value as Level })} title={t.impact ? IMPACT_HELP[t.impact] : undefined}>
            <option value="">Select…</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}: {IMPACT_HELP[l]}
              </option>
            ))}
          </select>
        </dd>
        <dt>
          <label htmlFor={`${ids}-urg`}>Urgency</label>
        </dt>
        <dd>
          <select id={`${ids}-urg`} value={t.urgency ?? ''} onChange={(e) => set({ urgency: e.target.value as Level })} title={t.urgency ? URGENCY_HELP[t.urgency] : undefined}>
            <option value="">Select…</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}: {URGENCY_HELP[l]}
              </option>
            ))}
          </select>
        </dd>
        <dt>Priority</dt>
        <dd className="wk-details-prio">
          <PriorityPill p={p ?? logged} long />
          <span className="tiny muted">{p ? (p !== logged ? `Logged as ${logged}` : 'From impact x urgency') : `As logged; set impact and urgency`}</span>
        </dd>
      </dl>
    </section>
  );
}

/** Other users' tickets about the same problem: link them here and update everyone at once. */
function RelatedTicketsCard({ work }: { work: Work }) {
  const sc = work.scenario;
  const s = work.session;
  const related = sc.related ?? [];
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const linked = s.linked ?? [];
  return (
    <section className="card">
      <div className="card-head">
        <h3>Similar tickets</h3>
        <span className="pill pill-warning num">{related.length} in the last 15 min</span>
      </div>
      <p className="card-sub">Other people are reporting the same problem. Link their tickets to this one so it is handled once, then keep everyone updated.</p>
      <ul className="wk-related">
        {related.map((r) => {
          const done = linked.includes(r.id);
          return (
            <li key={r.id}>
              <div className="wk-related-text">
                <span>
                  <span className="mono">{r.id}</span> · <strong>{r.name}</strong> <span className="muted">({r.department}, {r.minutesAgo} min ago)</span>
                </span>
                <span className="muted">{r.text}</span>
              </div>
              {done ? (
                <span className="pill pill-success">
                  <Link2 aria-hidden />
                  Linked
                </span>
              ) : (
                <button className="btn btn-sm" onClick={() => work.emit({ type: 'link', id: r.id })}>
                  <Link2 size={14} aria-hidden />
                  Link
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {s.notified ? (
        <p className="tiny muted">Update sent to {linked.length + 1} people.</p>
      ) : (
        <button
          className="btn btn-sm btn-block"
          disabled={!linked.length}
          onClick={() => {
            setText(
              `We're aware of a problem affecting ${sc.category === 'Network' ? 'network access' : 'this service'} and are working on it now. We'll send another update within 30 minutes. You don't need to raise a separate ticket. Thank you for your patience.`,
            );
            setWriting(true);
          }}
        >
          <Megaphone size={14} aria-hidden />
          Update everyone affected
        </button>
      )}
      {writing && (
        <Modal title="Update everyone affected" onClose={() => setWriting(false)}>
          <p className="muted">Sent to {sc.requester.name} and the {linked.length} linked requesters. Say what is known, what you are doing and when the next update comes.</p>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Update" />
          <div className="modal-actions">
            <button className="btn" onClick={() => setWriting(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={text.trim().length < 20}
              onClick={() => {
                work.emit({ type: 'notify', text });
                setWriting(false);
              }}
            >
              <Send size={14} aria-hidden />
              Send update
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function IdentityPill({ s }: { s?: SessionState }) {
  if (s?.verified)
    return (
      <span className="pill pill-success">
        <ShieldCheck size={12} aria-hidden />
        Verified
      </span>
    );
  if (s?.verifyAttempted)
    return (
      <span className="pill pill-danger">
        <ShieldX size={12} aria-hidden />
        Failed
      </span>
    );
  return (
    <span className="pill pill-outline">
      <ShieldQuestion size={12} aria-hidden />
      Not verified
    </span>
  );
}

function RequesterCard({ scenario, s }: { scenario: Scenario; s?: SessionState }) {
  const r = scenario.requester;
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          Requester
        </h3>
        {s && <IdentityPill s={s} />}
      </div>
      <div className="ws-requester-head">
        <div className="avatar" aria-hidden>
          {initials(r.name)}
        </div>
        <div className="ws-requester-text">
          <div className="ws-requester-name">
            {r.name}
            {r.vip && (
              <span className="pill pill-warning">
                <Crown size={12} aria-hidden />
                VIP
              </span>
            )}
          </div>
          <div className="ws-requester-title">{r.title}</div>
        </div>
      </div>
      <dl className="kv">
        {s && (
          <>
            <dt>Mood</dt>
            <dd>
              <span className={`wk-mood ${moodLabel(s.patience ?? 70).tone}`}>
                <span className="wk-mood-bar">
                  <i style={{ width: `${s.patience ?? 70}%` }} />
                </span>
                {moodLabel(s.patience ?? 70).label}
              </span>
            </dd>
          </>
        )}
        <dt>Department</dt>
        <dd>{r.department}</dd>
        <dt>Location</dt>
        <dd>{r.location}</dd>
        <dt>Email</dt>
        <dd className="ws-email">{r.email}</dd>
        <dt>Phone</dt>
        <dd className="num">{r.phone}</dd>
      </dl>
    </section>
  );
}

function ToolsCard({ work }: { work: Work }) {
  const sc = work.scenario;
  const tools: { to: string; icon: LucideIcon; label: string; sub: string; id?: boolean }[] = [
    { to: `/directory/${sc.account.username}`, icon: IdCard, label: 'Directory', sub: sc.account.username, id: true },
    { to: `/devices/${sc.device.hostname}`, icon: MonitorSmartphone, label: 'Remote desktop', sub: sc.device.hostname, id: true },
    { to: '/servers', icon: Server, label: 'Server room', sub: 'Shared infrastructure' },
    { to: '/deploy', icon: PackageCheck, label: 'Deployment', sub: 'Push software' },
  ];
  return (
    <section className="card">
      <div className="card-head">
        <h3>Workstation</h3>
      </div>
      <div className="wk-tools">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="wk-tool">
            <t.icon size={16} aria-hidden />
            <span className="wk-tool-text">
              <span className="wk-tool-label">{t.label}</span>
              <span className={`wk-tool-sub ${t.id ? 'mono' : ''}`}>{t.sub}</span>
            </span>
            <ArrowRight size={14} className="wk-tool-go" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function FindingsCard({ scenario, s }: { scenario: Scenario; s: SessionState }) {
  const found = scenario.facts.filter((f) => s.revealed.includes(f.id));
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          Findings
        </h3>
        <span className="pill num">{found.length}</span>
      </div>
      {found.length === 0 ? (
        <p className="ws-empty-hint">Evidence you uncover in the conversation and the tools collects here.</p>
      ) : (
        <ul className="facts">
          {found.map((f) => (
            <li key={f.id}>
              <CircleDot size={14} aria-hidden />
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RelatedKbCard({ scenario, s }: { scenario: Scenario; s: SessionState }) {
  const related = scenario.kb.filter((k) => KB_BY_ID[k]);
  if (!related.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          Related articles
        </h3>
      </div>
      <div className="wk-tools">
        {related.map((k) => (
          <Link key={k} to={`/kb/${k}`} className="wk-tool">
            <FileText size={16} aria-hidden />
            <span className="wk-tool-text">
              <span className="wk-tool-label">{KB_BY_ID[k].title}</span>
            </span>
            {s.kbOpened.includes(k) && <CheckCheck size={14} className="wk-tool-go" aria-label="Opened" />}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActivityCard({ s }: { s: SessionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [s.log.length]);
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          Activity
        </h3>
        <span className="pill num">{s.log.length}</span>
      </div>
      <div className="log" ref={ref}>
        {s.log.map((l, i) => {
          const Icon = LOG_ICON[l.kind] ?? CircleDot;
          return (
            <div key={i} className="ws-log-row" title={l.text}>
              <span className="t">{formatClock(l.at)}</span>
              <Icon size={12} aria-hidden />
              <span>{l.text.length > 90 ? l.text.slice(0, 90) + '…' : l.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Conversation ----------------

/** Canned responses: the phrases analysts keep in their back pocket. {first} and {me} are filled in. */
const CANNED: { label: string; text: string; note?: boolean }[] = [
  { label: 'Greeting', text: "Hi {first}, thanks for contacting the Service Desk. My name is {me} and I'll be helping you today." },
  { label: 'Empathy', text: "I'm sorry for the trouble, I understand how disruptive this is. Let's get it sorted." },
  { label: 'Hold', text: 'Let me check a few things on my side. Please bear with me for a moment.' },
  { label: 'Ask to connect remotely', text: 'Would it be okay if I connect to your computer remotely to take a look?' },
  { label: 'Warn before restart', text: "I'm going to restart your computer now. Please save anything you're working on first." },
  { label: 'Progress update', text: "Quick update: I've found what's causing this and I'm working on the fix now." },
  { label: 'Anything else?', text: 'Is there anything else I can help you with today?' },
];

function clockAt(startedAt: number, at: number | undefined) {
  return new Date(startedAt + (at ?? 0) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Simulated reading and typing time for a requester message. */
function typingDelay(text: string) {
  return 550 + Math.min(3200, text.length * 22);
}

function ChatMessageRow({
  m,
  name,
  startedAt,
  first,
  last,
  receipt,
}: {
  m: ChatMessage;
  name: string;
  startedAt: number;
  /** First of a run of messages from the same sender (shows the avatar). */
  first: boolean;
  /** Last of the run (shows the time). */
  last: boolean;
  receipt?: 'Seen' | 'Delivered';
}) {
  if (m.from === 'system') {
    const ok = m.text.startsWith('Identity verified');
    const bad = m.text.startsWith('Identity NOT');
    const Icon = ok ? ShieldCheck : bad ? ShieldX : Info;
    return (
      <div className={`msg system ws-sys ${ok ? 'ok' : bad ? 'bad' : ''}`}>
        <Icon size={14} aria-hidden />
        <span>{m.text}</span>
      </div>
    );
  }
  if (m.from === 'note') {
    return (
      <div className="wk-note">
        <span className="wk-note-head">
          <StickyNote size={13} aria-hidden />
          Internal note · {clockAt(startedAt, m.at)}
        </span>
        {m.text}
      </div>
    );
  }
  const step = m.from === 'agent' && m.text.startsWith(GUIDED_PREFIX);
  return (
    <div className={`wk-row ${m.from} ${first ? 'first' : ''}`}>
      {m.from === 'requester' &&
        (first ? (
          <span className="avatar wk-avatar" aria-hidden>
            {initials(name)}
          </span>
        ) : (
          <span className="wk-avatar-gap" aria-hidden />
        ))}
      <div className="wk-bubble-col">
        <div className={`msg ${m.from}`}>
          <span className="sr-only">{m.from === 'agent' ? 'You' : name}: </span>
          {step ? (
            <>
              <span className="ws-step-tag">
                <Compass size={12} aria-hidden />
                Asked the user to
              </span>
              {m.text.slice(GUIDED_PREFIX.length)}
            </>
          ) : (
            m.text
          )}
        </div>
        {last && (
          <span className="wk-meta">
            {clockAt(startedAt, m.at)}
            {receipt && (
              <>
                {' · '}
                {receipt === 'Seen' ? <CheckCheck size={12} aria-hidden /> : null}
                {receipt}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

const CHANNEL_VERB: Record<string, string> = { chat: 'Live chat', phone: 'Phone call', email: 'Email thread', portal: 'Portal ticket' };

function Conversation({ work }: { work: Work }) {
  const { state } = useStore();
  const sc = work.scenario;
  const s = work.session;
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [canned, setCanned] = useState(false);
  const [visible, setVisible] = useState(s.chat.length);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstName = sc.requester.name.split(' ')[0];
  const me = state.profile?.name.split(' ')[0] ?? 'the Service Desk';

  // Requester messages appear one at a time, after a reading-and-typing pause that grows with their length.
  useEffect(() => {
    if (s.chat.length <= visible) {
      setVisible(s.chat.length);
      return;
    }
    const nextMsg = s.chat[visible];
    if (nextMsg.from !== 'requester') {
      setVisible((v) => v + 1);
      return;
    }
    const t = setTimeout(() => setVisible((v) => v + 1), typingDelay(nextMsg.text));
    return () => clearTimeout(t);
  }, [s.chat, visible]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [visible]);

  let lastNonRequester = -1;
  s.chat.forEach((m, i) => {
    if (m.from !== 'requester') lastNonRequester = i;
  });
  const elapsedNow = useElapsed(work.startedAt);
  // Email and portal: replies show up when their time comes, in time order. Live chat: one at a time, with typing.
  const shown = s.async
    ? s.chat
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.from !== 'requester' || (m.at ?? 0) <= elapsedNow)
        .sort((a, b) => (a.m.at ?? 0) - (b.m.at ?? 0) || a.i - b.i)
        .map(({ m }) => m)
    : s.chat.slice(0, Math.max(visible, lastNonRequester + 1));
  const typing = !s.async && shown.length < s.chat.length;
  const awaiting = s.async && shown.length < s.chat.length;
  const lastAgent = shown.map((m) => m.from).lastIndexOf('agent');
  const available = sc.questions.filter((q) => !s.asked.includes(q.id) && (q.requires ?? []).every((f) => s.revealed.includes(f)));
  const guided = actionsForTool('guide').map((a) => ({ id: a.id, label: a.label, description: a.description }));
  const mood = moodLabel(s.patience ?? 70);
  const elapsed = useElapsed(work.startedAt);
  const firstReply = s.chat.find((m) => m.from === 'agent');
  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const target = firstResponseTarget(sc);
  const sla = firstReply
    ? { tone: (firstReply.at ?? 0) <= target ? 'success' : 'danger', text: `First reply in ${mmss(firstReply.at ?? 0)}` }
    : elapsed < target
      ? { tone: 'warning', text: `Reply within ${mmss(target - elapsed)}` }
      : { tone: 'danger', text: 'First reply overdue' };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    work.emit(mode === 'note' ? { type: 'note', text: t } : { type: 'say', text: t });
    setText('');
  };
  const insert = (raw: string) => {
    const filled = raw.replace(/\{first\}/g, firstName).replace(/\{me\}/g, me);
    setText((cur) => (cur.trim() ? `${cur.trim()} ${filled}` : filled));
    setMode('reply');
    setCanned(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <section className="card wk-convo" aria-label="Conversation">
      <div className="wk-chat-head">
        <span className="avatar wk-avatar-lg" aria-hidden>
          {initials(sc.requester.name)}
        </span>
        <div className="wk-chat-who">
          <h2>{sc.requester.name}</h2>
          <span className="wk-presence">
            <span className={`status-dot ${s.async ? 'warn' : 'ok'}`} aria-hidden />
            {typing ? `${firstName} is typing…` : s.async ? `${CHANNEL_VERB[sc.channel]} · replies when they check it` : `Online · ${CHANNEL_VERB[sc.channel] ?? 'Conversation'}`}
          </span>
        </div>
        <span className={`pill pill-${sla.tone} num`} title={`First reply target for ${CHANNEL_LABEL[sc.channel].toLowerCase()}: ${mmss(target)}`}>
          <Timer aria-hidden />
          {sla.text}
        </span>
        <span className={`pill pill-${mood.tone}`} title="How the requester is feeling">
          {mood.label}
        </span>
        <IdentityPill s={s} />
      </div>

      <div className="ws-chat-frame">
        <div className="chat wk-chat" aria-live="polite">
          {shown.map((m, i) => {
            const prev = shown[i - 1];
            const nextM = shown[i + 1];
            const firstOfRun = !prev || prev.from !== m.from;
            const lastOfRun = !nextM || nextM.from !== m.from;
            const receipt = i === lastAgent ? (shown.slice(i + 1).some((x) => x.from === 'requester') || typing ? 'Seen' : 'Delivered') : undefined;
            return <ChatMessageRow key={i} m={m} name={sc.requester.name} startedAt={work.startedAt} first={firstOfRun} last={lastOfRun} receipt={receipt} />;
          })}
          {typing && (
            <div className="wk-row requester first">
              <span className="avatar wk-avatar" aria-hidden>
                {initials(sc.requester.name)}
              </span>
              <div className="msg requester wk-typing" aria-label={`${firstName} is typing`}>
                <span className="typing-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
          {awaiting && (
            <div className="wk-awaiting" role="status">
              <Hourglass size={14} aria-hidden />
              Waiting for {firstName} to reply by {sc.channel === 'email' ? 'email' : 'the portal'}…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className={`wk-composer-box ${mode === 'note' ? 'note' : ''}`}>
        <div className="wk-composer-tabs" role="tablist" aria-label="Message type">
          <button type="button" role="tab" aria-selected={mode === 'reply'} className={mode === 'reply' ? 'on' : ''} onClick={() => setMode('reply')}>
            Reply to {firstName}
          </button>
          <button type="button" role="tab" aria-selected={mode === 'note'} className={mode === 'note' ? 'on' : ''} onClick={() => setMode('note')}>
            <StickyNote size={13} aria-hidden />
            Work note
          </button>
        </div>
        <textarea
          ref={inputRef}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={mode === 'note' ? 'Internal note: findings, what you tried. Only IT sees this.' : `Message ${firstName}…`}
          aria-label={mode === 'note' ? 'Work note' : 'Message'}
        />
        <div className="wk-composer-bar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCanned((c) => !c)} aria-expanded={canned}>
            <MessageSquareText size={14} aria-hidden />
            Canned responses
          </button>
          <span className="wk-composer-hint">Enter to send · Shift+Enter for a new line</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim()}>
            {mode === 'note' ? <StickyNote size={14} aria-hidden /> : <Send size={14} aria-hidden />}
            {mode === 'note' ? 'Add note' : 'Send'}
          </button>
        </div>
        {canned && (
          <ul className="wk-canned" aria-label="Canned responses">
            {CANNED.map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => insert(c.text)}>
                  <strong>{c.label}</strong>
                  <span>{c.text.replace(/\{first\}/g, firstName).replace(/\{me\}/g, me)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="wk-quick">
        <div className="label ws-label-row">
          <MessageCircleQuestion size={14} aria-hidden />
          Suggested questions
        </div>
        <div className="suggestions ws-questions">
          {!s.verifyAttempted && (
            <button className="suggestion verify" onClick={() => work.emit({ type: 'verify' })}>
              <Fingerprint size={16} aria-hidden />
              <span>Verify identity</span>
            </button>
          )}
          {available.map((q) => (
            <button key={q.id} className="suggestion" onClick={() => work.emit({ type: 'ask', questionId: q.id })}>
              <MessageCircleQuestion size={16} aria-hidden />
              <span>{q.text}</span>
            </button>
          ))}
          <button className="suggestion wk-confirm" onClick={() => work.emit({ type: 'confirm' })}>
            <ThumbsUp size={16} aria-hidden />
            <span>{s.confirmed ? 'Fix confirmed' : 'Ask them to confirm the fix'}</span>
          </button>
        </div>
      </div>

      <details className="ws-guided">
        <summary>
          <ListChecks size={16} aria-hidden />
          <span className="ws-guided-text">
            <span>Ask {firstName} to do something</span>
            <span className="ws-guided-sub">Steps the user carries out on their side</span>
          </span>
        </summary>
        <div className="ws-guided-body">
          <ActionList items={guided} session={s} onRun={(id) => work.emit({ type: 'action', actionId: id })} />
        </div>
      </details>
    </section>
  );
}

// ---------------- Resolve ----------------

type Field = 'rootCause' | 'team' | 'note' | 'reply';

function ResolveForm({
  scenario,
  s,
  onSubmit,
}: {
  scenario: Scenario;
  s: SessionState;
  onSubmit: (sub: { rootCause: string; outcome: Outcome; team?: Team; note: string; reply: string }) => void;
}) {
  const [rootCause, setRootCause] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('resolve');
  const [team, setTeam] = useState<Team | ''>('');
  const [note, setNote] = useState(() =>
    s.chat
      .filter((m) => m.from === 'note')
      .map((m) => m.text)
      .join('\n'),
  );
  const [reply, setReply] = useState('');
  const [error, setError] = useState<{ field: Field; text: string } | null>(null);
  const firstName = scenario.requester.name.split(' ')[0];
  const ids = useId();
  const causes = useMemo(() => [...scenario.rootCauses].sort(() => Math.random() - 0.5), [scenario]);
  const invalid = (f: Field) => (error?.field === f ? 'ws-invalid' : '');

  const submit = () => {
    if (!rootCause) return setError({ field: 'rootCause', text: 'Choose a root cause.' });
    if (outcome === 'escalate' && !team) return setError({ field: 'team', text: 'Choose the team to assign it to.' });
    if (note.trim().length < 10) return setError({ field: 'note', text: 'Write some work notes first.' });
    if (reply.trim().length < 10) return setError({ field: 'reply', text: `Write a closing message to ${firstName}.` });
    onSubmit({ rootCause, outcome, team: outcome === 'escalate' ? (team as Team) : undefined, note, reply });
  };

  return (
    <div className="stack wk-resolve">
      {outcome === 'resolve' && !s.confirmed && scenario.correctOutcome === 'resolve' && (
        <div className="callout info small">
          <Info size={16} aria-hidden />
          <div className="callout-body">You haven't confirmed the fix with {firstName} yet.</div>
        </div>
      )}
      {(!s.triage?.category || !triagedPriority(s.triage)) && (
        <div className="callout warning small">
          <CircleAlert size={16} aria-hidden />
          <div className="callout-body">Set the category, impact and urgency in Ticket details first. Triage is part of the grade.</div>
        </div>
      )}
      <fieldset className={`ws-fieldset ${invalid('rootCause')}`}>
        <legend className="ws-legend">Root cause</legend>
        <div className="ws-causes">
          {causes.map((c) => (
            <label key={c.id} className="radio-row">
              <input type="radio" name={`${ids}-rc`} checked={rootCause === c.id} onChange={() => setRootCause(c.id)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ws-field">
        <span className="ws-field-label" id={`${ids}-outcome`}>
          Resolution
        </span>
        <div className="seg" role="radiogroup" aria-labelledby={`${ids}-outcome`}>
          {OUTCOMES.map(({ id: o, label, desc, icon: Icon }) => (
            <button key={o} type="button" role="radio" aria-checked={outcome === o} className={outcome === o ? 'active' : ''} onClick={() => setOutcome(o)} title={desc}>
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {outcome === 'escalate' && (
        <div className={`ws-field ${invalid('team')}`}>
          <label className="ws-field-label" htmlFor={`${ids}-team`}>
            Assignment group
          </label>
          <select id={`${ids}-team`} value={team} onChange={(e) => setTeam(e.target.value as Team)}>
            <option value="">Select a team…</option>
            {TEAMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      <div className={`ws-field ${invalid('note')}`}>
        <label className="ws-field-label" htmlFor={`${ids}-note`}>
          Work notes <span className="ws-field-tag">internal</span>
        </label>
        <textarea id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Symptom, findings, cause, actions, result…" />
      </div>

      <div className={`ws-field ${invalid('reply')}`}>
        <div className="ws-field-head">
          <label className="ws-field-label" htmlFor={`${ids}-reply`}>
            Closing message to {firstName}
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setReply(
                `Hi ${firstName},\n\nThank you for reaching out. \n\n[What happened and what I did]\n\n[Anything you need to do next]\n\nIf it happens again, just reply to this ticket and we'll pick it straight back up.\n\nKind regards,\nService Desk`,
              )
            }
          >
            <FileText size={14} aria-hidden />
            Template
          </button>
        </div>
        <textarea id={`${ids}-reply`} value={reply} onChange={(e) => setReply(e.target.value)} rows={5} placeholder={`Hi ${firstName}, …`} />
      </div>

      {error && (
        <div className="callout danger small" role="alert">
          <CircleAlert size={16} aria-hidden />
          <div className="callout-body">{error.text}</div>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={submit}>
          <CheckCheck size={16} aria-hidden />
          Submit and close ticket
        </button>
      </div>
      <p className="tiny muted">
        <Clock size={12} aria-hidden /> Everything in this form is graded together with what you did in the tools.
      </p>
    </div>
  );
}
