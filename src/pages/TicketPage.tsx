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
  ListChecks,
  MessageCircleQuestion,
  MonitorSmartphone,
  PackageCheck,
  Play,
  SearchX,
  Send,
  Server,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  SquareTerminal,
  ThumbsUp,
  Timer,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { actionsForTool } from '../data/actions';
import { KB_BY_ID } from '../data/kb';
import { HINT_PENALTY, gradeTicket } from '../engine/scoring';
import { nextHint, type ChatMessage, type SessionState } from '../engine/session';
import { useStore, type Work } from '../state/store';
import { uid } from '../state/storage';
import { TEAMS, type Outcome, type Scenario, type Team, type TicketAttempt, type WorkLogEntry } from '../types';
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
import '../styles/workspace.css';
import '../styles/workstation.css';

const LOG_ICON: Record<WorkLogEntry['kind'], LucideIcon> = {
  question: MessageCircleQuestion,
  action: Wrench,
  terminal: SquareTerminal,
  kb: BookOpen,
  hint: Lightbulb,
  system: Info,
};

const OUTCOMES: { id: Outcome; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'resolve', label: 'Resolved', desc: 'Fixed at tier 1', icon: CircleCheck },
  { id: 'escalate', label: 'Escalate', desc: 'Assign to another team', icon: ArrowUpRight },
  { id: 'pending', label: 'Pending', desc: 'Waiting on the user', icon: Hourglass },
];

const GUIDED_PREFIX = '[Guided step] ';

export function TicketPage() {
  const { id = '' } = useParams();
  const { getScenario, work } = useStore();
  const scenario = getScenario(id);
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
  if (work?.scenario.id === scenario.id) return <AssignedTicket key={scenario.id} work={work} />;
  return <UnassignedTicket key={scenario.id} scenario={scenario} />;
}

function TicketMeta({ scenario, mode }: { scenario: Scenario; mode?: 'practice' | 'shift' }) {
  return (
    <>
      <PriorityPill p={scenario.priority} long />
      <CategoryPill category={scenario.category} />
      <span className="pill">
        <ChannelIcon channel={scenario.channel} />
        {CHANNEL_LABEL[scenario.channel]}
      </span>
      <DifficultyDots d={scenario.difficulty} showLabel />
      {mode === 'shift' && <ModePill mode="shift" />}
    </>
  );
}

// ---------------- Not yet assigned ----------------

function UnassignedTicket({ scenario }: { scenario: Scenario }) {
  const { state, work, dispatch } = useStore();
  const [params] = useSearchParams();
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const inShift =
    params.get('mode') === 'shift' && !!state.activeShift?.tickets.some((t) => t.scenarioId === scenario.id && t.status === 'waiting');
  const best = state.tickets.filter((t) => t.scenarioId === scenario.id).reduce<number | null>((m, t) => Math.max(m ?? 0, t.result.total), null);
  const r = scenario.requester;

  const assign = () => {
    dispatch({ type: 'startWork', scenarioId: scenario.id, mode: inShift ? 'shift' : 'practice', now: Date.now() });
    setConfirmSwitch(false);
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

          <section className="card wk-assign">
            {work ? (
              <>
                <div className="callout warning">
                  <Info size={18} aria-hidden />
                  <div className="callout-body">
                    You are working <Link to={`/ticket/${work.scenario.id}`}>{ticketNumber(work.scenario.id)}</Link> ({work.scenario.title}). Finish
                    it or release it before you take this one.
                  </div>
                </div>
                <div className="row">
                  <Link className="btn" to={`/ticket/${work.scenario.id}`}>
                    <ArrowLeft size={16} aria-hidden />
                    Back to {ticketNumber(work.scenario.id)}
                  </Link>
                  <button className="btn btn-danger" onClick={() => setConfirmSwitch(true)}>
                    Release it and take this ticket
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2>Pick up this ticket</h2>
                  <p className="muted">
                    Assigning it to yourself starts the clock (target {scenario.targetMinutes} min). Work it from the conversation and the
                    workstation apps: Directory, Server room, Remote desktop and Deployment. Resolve it when the fix is confirmed.
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

      {confirmSwitch && work && (
        <Modal title="Release your current ticket?" onClose={() => setConfirmSwitch(false)}>
          <p>
            Your progress on {ticketNumber(work.scenario.id)} will be discarded and it goes back to the queue unscored.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirmSwitch(false)} autoFocus>
              Keep working it
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'releaseWork' });
                assign();
              }}
            >
              Release and take this one
            </button>
          </div>
        </Modal>
      )}
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
            <TicketMeta scenario={sc} mode={work.mode} />
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
            <span className={`timer ${over ? 'over' : ''}`} title={`Target: ${sc.targetMinutes} min`} role="timer">
              <Timer size={16} aria-hidden />
              {formatClock(elapsed)}
            </span>
            <button className="btn btn-primary" onClick={() => setResolving(true)}>
              <ClipboardCheck size={16} aria-hidden />
              Resolve ticket
            </button>
          </>
        }
      />

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
                dispatch({ type: 'releaseWork' });
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

function ChatBubble({ m, name }: { m: ChatMessage; name: string }) {
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
  const step = m.from === 'agent' && m.text.startsWith(GUIDED_PREFIX);
  return (
    <div className={`msg ${m.from}`}>
      <span className="who">{m.from === 'agent' ? 'You' : name}</span>
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
  );
}

function Conversation({ work }: { work: Work }) {
  const sc = work.scenario;
  const s = work.session;
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(s.chat.length);
  const endRef = useRef<HTMLDivElement>(null);
  const firstName = sc.requester.name.split(' ')[0];

  // Simulated typing delay for requester replies.
  useEffect(() => {
    if (s.chat.length <= visible) {
      setVisible(s.chat.length);
      return;
    }
    const t = setTimeout(() => setVisible(s.chat.length), 650 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [s.chat.length, visible]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [visible]);

  let lastNonRequester = -1;
  s.chat.forEach((m, i) => {
    if (m.from !== 'requester') lastNonRequester = i;
  });
  const shown = s.chat.slice(0, Math.max(visible, lastNonRequester + 1));
  const typing = shown.length < s.chat.length;
  const available = sc.questions.filter((q) => !s.asked.includes(q.id) && (q.requires ?? []).every((f) => s.revealed.includes(f)));
  const guided = actionsForTool('guide').map((a) => ({ id: a.id, label: a.label, description: a.description }));

  return (
    <section className="card wk-convo" aria-label="Conversation">
      <div className="card-head">
        <h2>
          <ChannelIcon channel={sc.channel} size={18} />
          Conversation with {sc.requester.name}
        </h2>
        <IdentityPill s={s} />
      </div>
      <div className="ws-chat-frame">
        <div className="chat wk-chat" aria-live="polite">
          {shown.map((m, i) => (
            <ChatBubble key={i} m={m} name={sc.requester.name} />
          ))}
          {typing && (
            <div className="typing">
              <span className="typing-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              {firstName} is typing
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="ws-composer wk-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || typing) return;
          work.emit({ type: 'say', text });
          setText('');
        }}
      >
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply to ${firstName}…`} aria-label="Message" />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || typing}>
          <Send size={16} aria-hidden />
          Send
        </button>
      </form>

      <div className="wk-quick">
        <div className="label ws-label-row">
          <MessageCircleQuestion size={14} aria-hidden />
          Suggested replies
        </div>
        <div className="suggestions ws-questions">
          {!s.verifyAttempted && (
            <button className="suggestion verify" disabled={typing} onClick={() => work.emit({ type: 'verify' })}>
              <Fingerprint size={16} aria-hidden />
              <span>Verify identity</span>
            </button>
          )}
          {available.map((q) => (
            <button key={q.id} className="suggestion" disabled={typing} onClick={() => work.emit({ type: 'ask', questionId: q.id })}>
              <MessageCircleQuestion size={16} aria-hidden />
              <span>{q.text}</span>
            </button>
          ))}
          <button className="suggestion wk-confirm" disabled={typing} onClick={() => work.emit({ type: 'confirm' })}>
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
  const [note, setNote] = useState('');
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
