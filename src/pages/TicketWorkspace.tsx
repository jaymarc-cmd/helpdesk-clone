import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Clock,
  Compass,
  CornerDownRight,
  Crown,
  FileText,
  Fingerprint,
  History,
  Hourglass,
  IdCard,
  Inbox,
  Info,
  Laptop,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  Mail,
  MessageCircleQuestion,
  MessageSquare,
  MessagesSquare,
  ScanSearch,
  Search,
  SearchX,
  Send,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  SquareTerminal,
  Timer,
  TriangleAlert,
  UserRound,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ACTION_BY_ID, TOOL_LABELS, actionsForTool } from '../data/actions';
import { KB_ARTICLES, KB_BY_ID } from '../data/kb';
import { HINT_PENALTY, gradeTicket } from '../engine/scoring';
import { VERIFY_QUESTION_ID, initSession, nextHint, sessionReducer, type ChatMessage, type SessionState } from '../engine/session';
import { TERMINAL_HELP } from '../engine/terminal';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import { TEAMS, type Outcome, type Scenario, type Team, type TicketAttempt, type ToolId, type WorkLogEntry } from '../types';
import {
  CategoryPill,
  DifficultyDots,
  EmptyState,
  Markdown,
  Modal,
  ModePill,
  PageHeader,
  PriorityPill,
  formatClock,
  initials,
  ticketNumber,
  useNow,
} from '../components/ui';
import { CHANNEL_LABEL, ChannelIcon } from '../components/icons';
import '../styles/workspace.css';

type Tab = 'conversation' | 'directory' | 'endpoint' | 'terminal' | 'kb';

/** `short` replaces the label when the investigation panel is phone-narrow. */
const TABS: { id: Tab; label: string; short?: string; icon: LucideIcon }[] = [
  { id: 'conversation', label: 'Conversation', short: 'Chat', icon: MessageSquare },
  { id: 'directory', label: 'Directory', icon: IdCard },
  { id: 'endpoint', label: 'Endpoint', icon: Laptop },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'kb', label: 'KB', icon: BookOpen },
];

const LOG_ICON: Record<WorkLogEntry['kind'], LucideIcon> = {
  question: MessageSquare,
  action: Wrench,
  terminal: SquareTerminal,
  kb: BookOpen,
  hint: Lightbulb,
  system: Info,
};

const OUTCOMES: { id: Outcome; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'resolve', label: 'Resolve', desc: 'Resolved at tier 1', icon: CircleCheck },
  { id: 'escalate', label: 'Escalate', desc: 'Escalate to another team', icon: ArrowUpRight },
  { id: 'pending', label: 'Pending', desc: 'Pending (waiting on user)', icon: Hourglass },
];

/** Actions that ask for confirmation before they run. */
const DESTRUCTIVE = new Set(['reimage', 'remote_restart', 'isolate_device', 'repair_office', 'revoke_sessions']);

/** Prefix the session engine puts on agent messages sent by a guided step. */
const GUIDED_PREFIX = '[Guided step] ';

export function TicketWorkspace() {
  const { id = '' } = useParams();
  const { getScenario } = useStore();
  const scenario = getScenario(id);
  if (!scenario) {
    return (
      <div className="page ws-root">
        <PageHeader
          back={{ to: '/tickets', label: 'Ticket queue' }}
          eyebrow={
            <>
              <Inbox size={14} aria-hidden />
              <span>Practice</span>
            </>
          }
          title="Ticket not found"
        />
        <div className="card">
          <EmptyState icon={SearchX} title="This ticket isn't in the queue">
            <span className="ws-notfound">
              It may have been removed, or the link is out of date.
              <Link to="/tickets" className="btn btn-sm">
                <ArrowLeft size={14} aria-hidden />
                Back to queue
              </Link>
            </span>
          </EmptyState>
        </div>
      </div>
    );
  }
  // Remount on scenario change so all session state resets.
  return <Workspace key={scenario.id} scenario={scenario} />;
}

function Workspace({ scenario }: { scenario: Scenario }) {
  const { state, dispatch: storeDispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reducer = useMemo(() => sessionReducer(scenario), [scenario]);
  const [s, dispatch] = useReducer(reducer, scenario, initSession);
  const startedAt = useRef(Date.now());
  const now = useNow();
  const elapsed = (now - startedAt.current) / 1000;
  const at = () => Math.round((Date.now() - startedAt.current) / 1000);
  const [tab, setTab] = useState<Tab>('conversation');
  const [hint, setHint] = useState<string | null>(null);
  const [kbOpen, setKbOpen] = useState<string | null>(null);
  const tabIds = useId();

  const inShift =
    params.get('mode') === 'shift' &&
    !!state.activeShift?.tickets.some((t) => t.scenarioId === scenario.id && t.status === 'waiting');

  const over = elapsed > scenario.targetMinutes * 60;

  const openTab = (t: Tab) => {
    setTab(t);
    if (t === 'directory' || t === 'endpoint') dispatch({ type: 'openTool', tool: t, at: at() });
  };

  const openKb = (kbId: string) => {
    setKbOpen(kbId);
    dispatch({ type: 'openKb', id: kbId, at: at() });
    storeDispatch({ type: 'kbRead', id: kbId });
  };

  const showHint = () => {
    const text = nextHint(scenario, s);
    setHint(text);
    dispatch({ type: 'hint', text, at: at() });
  };

  const submit = (sub: { rootCause: string; outcome: Outcome; team?: Team; note: string; reply: string }) => {
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const result = gradeTicket(scenario, s, sub, durationSec);
    const attempt: TicketAttempt = {
      id: uid('t'),
      scenarioId: scenario.id,
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      mode: inShift ? 'shift' : 'practice',
      completedAt: new Date().toISOString(),
      durationSec,
      result,
      submission: sub,
      log: [...s.log, { at: durationSec, kind: 'system', text: `Ticket ${sub.outcome === 'escalate' ? `escalated to ${sub.team}` : sub.outcome === 'pending' ? 'set to pending' : 'resolved'}` }],
      hintsUsed: s.hintsUsed,
    };
    storeDispatch({ type: 'addTicket', attempt });
    navigate(`/review/${attempt.id}`, { replace: true });
  };

  const kbArticle = kbOpen ? KB_BY_ID[kbOpen] : undefined;

  return (
    <div className="page ws-root">
      <PageHeader
        back={inShift ? { to: '/shift', label: 'Shift board' } : { to: '/tickets', label: 'Ticket queue' }}
        eyebrow={
          <>
            <Inbox size={14} aria-hidden />
            <span>Practice · {ticketNumber(scenario.id)}</span>
            {inShift && <span className="live-dot">LIVE</span>}
          </>
        }
        title={scenario.title}
        meta={
          <>
            <PriorityPill p={scenario.priority} long />
            <CategoryPill category={scenario.category} />
            <DifficultyDots d={scenario.difficulty} showLabel />
            {inShift && <ModePill mode="shift" />}
            <span className="inline-icon">
              <Clock size={14} aria-hidden />
              <span>Target {scenario.targetMinutes} min</span>
            </span>
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
            <span className={`timer ${over ? 'over' : ''}`} title={`Target: ${scenario.targetMinutes} min`} role="timer">
              <Timer size={16} aria-hidden />
              {formatClock(elapsed)}
              {over && <span className="ws-timer-over">over target</span>}
            </span>
          </>
        }
      />

      {hint && (
        <div className="callout warning ws-hint" role="status">
          <Lightbulb size={18} aria-hidden />
          <div className="callout-body">
            <strong>Hint.</strong> {hint}
          </div>
          <button className="icon-btn" onClick={() => setHint(null)} aria-label="Dismiss hint">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="workspace">
        <aside className="ws-left" aria-label="Ticket details">
          <TicketInfo scenario={scenario} s={s} onKb={openKb} />
        </aside>

        <section className="card ws-center" aria-label="Investigation">
          <div className="tabs ws-tabs" role="tablist" aria-label="Investigation tools">
            {TABS.map(({ id: t, label, short, icon: Icon }) => (
              <button
                key={t}
                id={`${tabIds}-${t}`}
                role="tab"
                aria-selected={tab === t}
                aria-controls={`${tabIds}-panel`}
                aria-label={short ? label : undefined}
                className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => openTab(t)}
              >
                <Icon size={16} aria-hidden />
                {short ? (
                  <>
                    <span className="ws-tab-long">{label}</span>
                    <span className="ws-tab-short" aria-hidden>
                      {short}
                    </span>
                  </>
                ) : (
                  label
                )}
              </button>
            ))}
          </div>
          <div className="ws-panel" role="tabpanel" id={`${tabIds}-panel`} aria-labelledby={`${tabIds}-${tab}`}>
            {tab === 'conversation' && <Conversation scenario={scenario} s={s} dispatch={dispatch} at={at} />}
            {tab === 'directory' && <DirectoryTool scenario={scenario} s={s} dispatch={dispatch} at={at} />}
            {tab === 'endpoint' && <EndpointTool s={s} dispatch={dispatch} at={at} />}
            {tab === 'terminal' && <Terminal s={s} dispatch={dispatch} at={at} />}
            {tab === 'kb' && <KbBrowser related={scenario.kb} onOpen={openKb} />}
          </div>
        </section>

        <ResolutionPanel scenario={scenario} onSubmit={submit} />
      </div>

      {kbOpen && kbArticle && (
        <Modal title={kbArticle.title} onClose={() => setKbOpen(null)}>
          <div className="stack">
            <div className="row">
              <CategoryPill category={kbArticle.category} />
              {scenario.kb.includes(kbOpen) && (
                <span className="pill pill-primary">
                  <Link2 size={12} aria-hidden />
                  Related to this ticket
                </span>
              )}
            </div>
            <Markdown text={kbArticle.body} />
          </div>
        </Modal>
      )}
    </div>
  );
}

type Dispatch = (e: Parameters<ReturnType<typeof sessionReducer>>[1]) => void;

function IdentityPill({ s }: { s: SessionState }) {
  if (s.verified)
    return (
      <span className="pill pill-success">
        <ShieldCheck size={12} aria-hidden />
        Verified
      </span>
    );
  if (s.verifyAttempted)
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

// ---------------- Left: ticket info ----------------

function TicketInfo({ scenario, s, onKb }: { scenario: Scenario; s: SessionState; onKb: (id: string) => void }) {
  const r = scenario.requester;
  const found = scenario.facts.filter((f) => s.revealed.includes(f.id));
  const related = scenario.kb.filter((k) => KB_BY_ID[k]);
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest log entry in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.log.length]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>
            <UserRound size={16} aria-hidden />
            Requester
          </h3>
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
          <dd className="ws-email">
            {/* Break after the @ rather than mid-word when the column is narrow. */}
            {r.email.split('@')[0]}
            {r.email.includes('@') && (
              <>
                @<wbr />
                {r.email.split('@').slice(1).join('@')}
              </>
            )}
          </dd>
          <dt>Phone</dt>
          <dd className="num">{r.phone}</dd>
          <dt>Channel</dt>
          <dd>
            <span className="ws-channel">
              <ChannelIcon channel={scenario.channel} />
              {CHANNEL_LABEL[scenario.channel]}
            </span>
          </dd>
          <dt>Identity</dt>
          <dd>
            <IdentityPill s={s} />
          </dd>
        </dl>
      </section>

      <section className="card ws-findings">
        <div className="card-head">
          <h3>
            <ScanSearch size={16} aria-hidden />
            Findings
          </h3>
          <span className="pill num" aria-label={`${found.length} findings`}>
            {found.length}
          </span>
        </div>
        {found.length === 0 ? (
          <p className="ws-empty-hint">Evidence you uncover appears here. Ask questions, check tools, run commands.</p>
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

      <section className="card">
        <div className="card-head">
          <h3>
            <BookOpen size={16} aria-hidden />
            Related articles
          </h3>
        </div>
        {related.length === 0 ? (
          <p className="ws-empty-hint">No articles are linked to this ticket. Use the KB tab to search.</p>
        ) : (
          <div className="ws-link-list">
            {related.map((k) => (
              <button key={k} className="btn btn-ghost btn-sm ws-link-btn" onClick={() => onKb(k)}>
                <FileText size={16} aria-hidden />
                <span>{KB_BY_ID[k].title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>
            <History size={16} aria-hidden />
            Activity log
          </h3>
          <span className="pill num" aria-label={`${s.log.length} entries`}>
            {s.log.length}
          </span>
        </div>
        <div className="log" ref={logRef}>
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
    </>
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
            Guided step
          </span>
          {m.text.slice(GUIDED_PREFIX.length)}
        </>
      ) : (
        m.text
      )}
    </div>
  );
}

function Conversation({ scenario, s, dispatch, at }: { scenario: Scenario; s: SessionState; dispatch: Dispatch; at: () => number }) {
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(s.chat.length);
  const endRef = useRef<HTMLDivElement>(null);
  const firstName = scenario.requester.name.split(' ')[0];

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

  const available = scenario.questions.filter(
    (q) => !s.asked.includes(q.id) && (q.requires ?? []).every((f) => s.revealed.includes(f)),
  );

  return (
    <div className="stack">
      <div className="ws-chat-frame">
        <div className="ws-chat-head">
          <span className="ws-channel">
            <ChannelIcon channel={scenario.channel} />
            {CHANNEL_LABEL[scenario.channel]} with {scenario.requester.name}
          </span>
          <IdentityPill s={s} />
        </div>
        <div className="chat" aria-live="polite">
          {shown.map((m, i) => (
            <ChatBubble key={i} m={m} name={scenario.requester.name} />
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
        className="ws-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || typing) return;
          dispatch({ type: 'say', text, at: at() });
          setText('');
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type a message to ${firstName}…`}
          aria-label="Message"
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || typing}>
          <Send size={16} aria-hidden />
          Send
        </button>
      </form>

      <div>
        <div className="label ws-label-row">
          <MessagesSquare size={14} aria-hidden />
          Suggested questions
        </div>
        {available.length === 0 && s.verifyAttempted ? (
          <p className="ws-empty-hint">No more suggested questions. Type your own above, or try the tools.</p>
        ) : (
          <div className="suggestions ws-questions">
            {!s.verifyAttempted && (
              <button key={VERIFY_QUESTION_ID} className="suggestion verify" disabled={typing} onClick={() => dispatch({ type: 'verify', at: at() })}>
                <Fingerprint size={16} aria-hidden />
                <span>Verify identity</span>
              </button>
            )}
            {available.map((q) => (
              <button key={q.id} className="suggestion" disabled={typing} onClick={() => dispatch({ type: 'ask', questionId: q.id, at: at() })}>
                <MessageCircleQuestion size={16} aria-hidden />
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <details className="ws-guided">
        <summary>
          <ChevronRight size={16} className="chev" aria-hidden />
          <Compass size={16} aria-hidden />
          <span className="ws-guided-text">
            <span>Guided steps</span>
            <span className="ws-guided-sub">Ask {firstName} to do something</span>
          </span>
        </summary>
        <div className="ws-guided-body">
          <ActionGrid tool="guide" s={s} dispatch={dispatch} at={at} />
        </div>
      </details>
    </div>
  );
}

// ---------------- Tools ----------------

function ActionGrid({ tool, s, dispatch, at }: { tool: ToolId; s: SessionState; dispatch: Dispatch; at: () => number }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const actions = actionsForTool(tool);
  const results = s.actionResults.filter((r) => ACTION_BY_ID[r.id]?.tool === tool);
  // Latest result per action, shown under the action that produced it.
  const resultFor = new Map(results.map((r) => [r.id, r.text]));
  const latest = results[results.length - 1];

  const run = (id: string) => {
    if (DESTRUCTIVE.has(id)) setConfirm(id);
    else dispatch({ type: 'action', actionId: id, at: at() });
  };

  return (
    <>
      <div className="action-list ws-actions">
        {actions.map((a) => {
          const done = s.actions.includes(a.id);
          const result = resultFor.get(a.id);
          const locked = a.sensitive && !s.verified;
          const risky = DESTRUCTIVE.has(a.id);
          return (
            <div key={a.id} className={`ws-action ${done ? 'done' : ''}`}>
              <button className={`action-btn ${done ? 'done' : ''}`} onClick={() => run(a.id)} title={a.description}>
                <span className="lbl">
                  {done && <Check size={14} aria-hidden />}
                  {a.label}
                  {done && <span className="ws-sr"> (done)</span>}
                </span>
                <span className="desc">{a.description}</span>
                {(locked || risky) && (
                  <span className="ws-action-flags">
                    {locked && (
                      <span className="lock">
                        <Lock size={12} aria-hidden />
                        Requires identity verification
                      </span>
                    )}
                    {risky && (
                      <span className="ws-risky">
                        <TriangleAlert size={12} aria-hidden />
                        Disruptive
                      </span>
                    )}
                  </span>
                )}
              </button>
              {result && (
                <div className="ws-action-result">
                  <CornerDownRight size={14} aria-hidden />
                  <span>{result}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="ws-sr" aria-live="polite">
        {latest ? `${ACTION_BY_ID[latest.id]?.label ?? ''}: ${latest.text}` : ''}
      </div>
      {confirm && (
        <Modal title="Confirm action" onClose={() => setConfirm(null)}>
          <div className="stack">
            <div className="callout warning">
              <TriangleAlert size={18} aria-hidden />
              <div className="callout-body">
                <strong>{ACTION_BY_ID[confirm].label}</strong>: {ACTION_BY_ID[confirm].description}
              </div>
            </div>
            <div className="muted small">This is a disruptive action and is recorded on the ticket. Make sure your findings support it.</div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'action', actionId: confirm, at: at() });
                setConfirm(null);
              }}
            >
              <TriangleAlert size={16} aria-hidden />
              Yes, run it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function DirectoryTool({ scenario, s, dispatch, at }: { scenario: Scenario; s: SessionState; dispatch: Dispatch; at: () => number }) {
  const a = s.account;
  const statusTone = a.status === 'Active' ? 'success' : 'danger';
  const StatusIcon = a.status === 'Active' ? CircleCheck : a.status === 'Locked' ? Lock : Ban;
  return (
    <div className="stack">
      <div className="grid grid-2 ws-dir-grid">
        <section className="card card-tight">
          <div className="card-head">
            <h3 className="ws-mono-head">
              <UserRound size={16} aria-hidden />
              {a.username}
            </h3>
            <span className={`pill pill-${statusTone}`}>
              <StatusIcon size={12} aria-hidden />
              {a.status}
            </span>
          </div>
          <div className="stack">
            {a.statusNote && (
              <div className="callout warning small">
                <TriangleAlert size={16} aria-hidden />
                <div className="callout-body">{a.statusNote}</div>
              </div>
            )}
            <dl className="kv">
              <dt>Password set</dt>
              <dd>
                {a.passwordLastSet} {a.passwordExpired && <span className="pill pill-danger">Expired</span>}
              </dd>
              <dt>MFA</dt>
              <dd>{a.mfa}</dd>
              <dt>Last logon</dt>
              <dd>{a.lastLogon}</dd>
              <dt>Failed logons</dt>
              <dd>{a.failedLogons > 0 ? <span className="pill pill-warning">{a.failedLogons}</span> : <span className="num">{a.failedLogons}</span>}</dd>
              {a.activeSessions !== undefined && (
                <>
                  <dt>Sessions</dt>
                  <dd>{a.activeSessions} active</dd>
                </>
              )}
            </dl>
          </div>
        </section>
        <section className="card card-tight">
          <div className="card-head">
            <h3>
              <Users size={16} aria-hidden />
              Groups
            </h3>
            <span className="pill num" aria-label={`${a.groups.length} groups`}>
              {a.groups.length}
            </span>
          </div>
          {a.groups.length === 0 ? (
            <p className="ws-empty-hint">No group memberships.</p>
          ) : (
            <div className="ws-pill-wrap">
              {a.groups.map((g) => (
                <span key={g} className="pill pill-outline">
                  {g}
                </span>
              ))}
            </div>
          )}
          <div className="ws-divider">
            <div className="ws-subhead">
              <Mail size={14} aria-hidden />
              Mailbox
            </div>
            <dl className="kv">
              <dt>Usage</dt>
              <dd>{a.mailboxUsage ?? '–'}</dd>
              <dt>Archive</dt>
              <dd>{a.archive ?? '–'}</dd>
            </dl>
          </div>
        </section>
      </div>

      <section className="card card-tight">
        <div className="card-head">
          <h3>
            <History size={16} aria-hidden />
            Sign-in log
          </h3>
          {!s.signInLogViewed ? (
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'viewSignInLog', at: at() })}>
              <History size={14} aria-hidden />
              Load sign-in log
            </button>
          ) : (
            <span className="pill pill-success">
              <Check size={12} aria-hidden />
              Reviewed
            </span>
          )}
        </div>
        <p className="card-sub">Recent authentication events for this account. Loading the log is recorded on the ticket.</p>
        {s.signInLogViewed && (
          <SignInLog lines={scenario.signInLog?.lines ?? [`${a.lastLogon}  SUCCESS   Windows sign-in   ${s.device.hostname}`, 'No failures in the last 24 hours.']} />
        )}
      </section>

      <div className="card-head ws-section-head">
        <h3>
          <Wrench size={16} aria-hidden />
          {TOOL_LABELS.directory} actions
        </h3>
      </div>
      <ActionGrid tool="directory" s={s} dispatch={dispatch} at={at} />
    </div>
  );
}

const SIGNIN_TONE: Record<string, string> = { SUCCESS: 'pill-success', FAILURE: 'pill-danger', LOCKOUT: 'pill-warning' };

/**
 * Sign-in log lines are column-aligned text ("time  STATUS  source  detail…").
 * Split on runs of 2+ spaces so each event reads as a row that wraps cleanly at any width;
 * anything that doesn't look like an event is shown as a plain note.
 */
function SignInLog({ lines }: { lines: string[] }) {
  return (
    <ul className="ws-signin" aria-label="Sign-in events">
      {lines.map((line, i) => {
        const [time, status, source, ...rest] = line.trim().split(/\s{2,}/);
        if (!status || !source || !/^[A-Z][A-Z ]*$/.test(status)) {
          return (
            <li key={i} className="ws-signin-note">
              {line.trim()}
            </li>
          );
        }
        return (
          <li key={i} className="ws-signin-row">
            <span className="ws-signin-time">{time}</span>
            <span className="ws-signin-status">
              <span className={`pill ${SIGNIN_TONE[status] ?? 'pill-outline'}`}>{status}</span>
            </span>
            <span className="ws-signin-event">
              <span>{source}</span>
              {rest.length > 0 && <span className="ws-signin-detail">{rest.join(' · ')}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EndpointTool({ s, dispatch, at }: { s: SessionState; dispatch: Dispatch; at: () => number }) {
  const d = s.device;
  const powered = !(d.ip === '' && !d.online);
  return (
    <div className="stack">
      <section className="card card-tight">
        <div className="card-head">
          <h3 className="ws-mono-head">
            <Laptop size={16} aria-hidden />
            {d.hostname}
          </h3>
          <span className={`pill ${d.online ? 'pill-success' : 'pill-danger'}`}>
            <span className={`status-dot ${d.online ? 'ok' : 'bad'}`} aria-hidden />
            {d.online ? 'Online' : powered ? 'Not reachable' : 'Offline / powered off'}
          </span>
        </div>
        <dl className="kv">
          <dt>Model</dt>
          <dd>{d.model}</dd>
          <dt>OS</dt>
          <dd>{d.os}</dd>
          <dt>IP address</dt>
          <dd className="mono">{d.ip || '–'}</dd>
          <dt>Disk free</dt>
          <dd>{d.diskFree}</dd>
          <dt>Uptime</dt>
          <dd>{d.uptime}</dd>
          <dt>Last patch</dt>
          <dd>{d.lastPatch}</dd>
        </dl>
        {d.installedNotes && d.installedNotes.length > 0 && (
          <div className="ws-divider">
            <div className="ws-subhead">
              <ListChecks size={14} aria-hidden />
              Inventory &amp; health
            </div>
            <ul className="ws-inventory">
              {d.installedNotes.map((n) => (
                <li key={n}>
                  <CircleDot size={12} aria-hidden />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <div className="card-head ws-section-head">
        <h3>
          <Wrench size={16} aria-hidden />
          {TOOL_LABELS.endpoint} actions
        </h3>
      </div>
      <ActionGrid tool="endpoint" s={s} dispatch={dispatch} at={at} />
    </div>
  );
}

function Terminal({ s, dispatch, at }: { s: SessionState; dispatch: Dispatch; at: () => number }) {
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = `PS C:\\Users\\${s.account.username}>`;

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [s.terminal.length]);

  return (
    <div className="stack">
      {s.device.online ? (
        <p className="ws-empty-hint">
          Remote shell on <strong className="mono">{s.device.hostname}</strong>. Type <code>help</code> for commands.
        </p>
      ) : (
        <div className="callout info small">
          <Info size={16} aria-hidden />
          <div className="callout-body">
            <strong className="mono">{s.device.hostname}</strong> is off the network, so the user runs the commands and reads you the results. Type{' '}
            <code>help</code> for commands.
          </div>
        </div>
      )}
      <div className="ws-term">
        <div className="terminal-bar">
          <SquareTerminal size={14} aria-hidden />
          <span className="ws-term-title">PowerShell · {s.device.hostname}</span>
          <span className="ws-term-status">
            <span className={`status-dot ${s.device.online ? 'ok' : 'bad'}`} aria-hidden />
            {s.device.online ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="terminal" ref={boxRef} onClick={() => inputRef.current?.focus()}>
          {s.terminal.length === 0 && (
            <div className="ws-term-banner">
              {s.device.online
                ? 'Windows PowerShell: remote session established.'
                : 'Windows PowerShell: relayed session, no remote connection.'}
              {'\n\n'}
            </div>
          )}
          {s.terminal.map((l, i) => (
            <div key={i} className="ws-term-entry">
              <div className="ws-term-line">
                <span className="prompt">{prompt}</span> {l.cmd}
              </div>
              {/* One element per output line so long lines wrap with a hanging indent instead of breaking the columns. */}
              {l.output !== '' &&
                l.output.split('\n').map((line, j) => (
                  <div key={j} className="ws-term-line">
                    {line}
                  </div>
                ))}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cmd.trim()) return;
              dispatch({ type: 'command', raw: cmd, at: at() });
              setHist((h) => [cmd, ...h]);
              setHIdx(-1);
              setCmd('');
            }}
          >
            <span className="prompt">{prompt}</span>{' '}
            <input
              ref={inputRef}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' && hist.length) {
                  e.preventDefault();
                  const n = Math.min(hist.length - 1, hIdx + 1);
                  setHIdx(n);
                  setCmd(hist[n]);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const n = hIdx - 1;
                  setHIdx(n);
                  setCmd(n >= 0 ? hist[n] : '');
                }
              }}
              aria-label="Terminal command"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      </div>
      <div>
        <div className="label ws-label-row">
          <SquareTerminal size={14} aria-hidden />
          Common commands
        </div>
        <div className="suggestions">
          {TERMINAL_HELP.slice(0, 8).map((h) => {
            const c = h.cmd.replace(/\s*[[<].*$/, '');
            return (
              <button key={h.cmd} className="suggestion mono" onClick={() => dispatch({ type: 'command', raw: c, at: at() })} title={h.desc}>
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KbBrowser({ related, onOpen }: { related: string[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = KB_ARTICLES.filter((a) =>
    q ? `${a.title} ${a.tags.join(' ')} ${a.body}`.toLowerCase().includes(q.toLowerCase()) : true,
  ).sort((a, b) => Number(related.includes(b.id)) - Number(related.includes(a.id)));
  const linked = list.filter((a) => related.includes(a.id));
  const others = list.filter((a) => !related.includes(a.id));

  const item = (a: (typeof KB_ARTICLES)[number]) => (
    <button key={a.id} className="ws-kb-item" onClick={() => onOpen(a.id)}>
      <FileText size={16} aria-hidden />
      <span className="ws-kb-text">
        <span className="ws-kb-title">{a.title}</span>
        <span className="ws-kb-meta">
          {a.category} · {a.tags.slice(0, 4).join(', ')}
        </span>
      </span>
      <ChevronRight size={16} className="ws-kb-chev" aria-hidden />
    </button>
  );

  return (
    <div className="stack">
      <div className="search">
        <Search size={16} aria-hidden />
        <input type="search" placeholder="Search the knowledge base…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the knowledge base" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching articles">
          Try a different keyword, such as a product name or an error message.
        </EmptyState>
      ) : (
        <>
          {linked.length > 0 && (
            <div>
              <div className="label ws-label-row">
                <Link2 size={14} aria-hidden />
                Related to this ticket
              </div>
              <div className="ws-kb-list related">{linked.map(item)}</div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <div className="label ws-label-row">
                <BookOpen size={14} aria-hidden />
                {q ? (linked.length ? 'Other matches' : 'Matches') : linked.length ? 'Other articles' : 'All articles'} · {others.length}
              </div>
              <div className="ws-kb-list">{others.map(item)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- Right: resolution ----------------

function ResolutionPanel({
  scenario,
  onSubmit,
}: {
  scenario: Scenario;
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

  // Shuffle root cause options once so the answer isn't always first.
  const causes = useMemo(() => [...scenario.rootCauses].sort(() => Math.random() - 0.5), [scenario]);

  const fail = (field: Field, text: string) => setError({ field, text });
  /** Editing the field an error points at clears that error. */
  const touched = (field: Field) => {
    if (error?.field === field) setError(null);
  };
  const invalid = (field: Field) => (error?.field === field ? 'ws-invalid' : '');
  const panelRef = useRef<HTMLElement>(null);

  // Take the user to the field the validation message is about (it may be scrolled out of the panel).
  useEffect(() => {
    if (!error) return;
    panelRef.current?.querySelector<HTMLElement>('.ws-invalid input, .ws-invalid select, .ws-invalid textarea')?.focus();
  }, [error]);

  const submit = () => {
    if (!rootCause) return fail('rootCause', 'Choose a root cause.');
    if (outcome === 'escalate' && !team) return fail('team', 'Choose the team to escalate to.');
    if (note.trim().length < 10) return fail('note', 'Write some work notes first.');
    if (reply.trim().length < 10) return fail('reply', `Write a reply to ${firstName}.`);
    onSubmit({ rootCause, outcome, team: outcome === 'escalate' ? (team as Team) : undefined, note, reply });
  };

  const current = OUTCOMES.find((o) => o.id === outcome);

  return (
    <aside className="card ws-resolution" aria-label="Resolution" ref={panelRef}>
      <div className="card-head">
        <h3>
          <ClipboardCheck size={16} aria-hidden />
          Resolution
        </h3>
      </div>
      <p className="card-sub">Everything below is graded when you submit.</p>
      <div className="ws-res-layout">
        <div className="ws-res-col">
          <fieldset className={`ws-fieldset ${invalid('rootCause')}`}>
            <legend className="ws-legend">Root cause</legend>
            <div className="ws-causes">
              {causes.map((c) => (
                <label key={c.id} className="radio-row">
                  <input
                    type="radio"
                    name={`${ids}-rc`}
                    checked={rootCause === c.id}
                    onChange={() => {
                      setRootCause(c.id);
                      touched('rootCause');
                    }}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="ws-field">
            <span className="ws-field-label" id={`${ids}-outcome`}>
              Outcome
            </span>
            <div className="seg ws-outcome" role="radiogroup" aria-labelledby={`${ids}-outcome`}>
              {OUTCOMES.map(({ id: o, label, desc, icon: Icon }) => (
                <button key={o} type="button" role="radio" aria-checked={outcome === o} className={outcome === o ? 'active' : ''} onClick={() => setOutcome(o)} title={desc}>
                  <Icon size={14} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {current && <span className="ws-outcome-desc">{current.desc}</span>}
          </div>

          {outcome === 'escalate' && (
            <div className={`ws-field ${invalid('team')}`}>
              <label className="ws-field-label" htmlFor={`${ids}-team`}>
                Assign to team
              </label>
              <select
                id={`${ids}-team`}
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value as Team);
                  touched('team');
                }}
              >
                <option value="">Select a team…</option>
                {TEAMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="ws-res-col">
          <div className={`ws-field ${invalid('note')}`}>
            <label className="ws-field-label" htmlFor={`${ids}-note`}>
              Work notes <span className="ws-field-tag">internal</span>
            </label>
            <span className="ws-note-hint" id={`${ids}-note-hint`}>
              Symptom
              <ChevronRight size={12} aria-hidden />
              findings
              <ChevronRight size={12} aria-hidden />
              cause
              <ChevronRight size={12} aria-hidden />
              actions
              <ChevronRight size={12} aria-hidden />
              result
            </span>
            <textarea
              id={`${ids}-note`}
              aria-describedby={`${ids}-note-hint`}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                touched('note');
              }}
              rows={4}
              placeholder="e.g. Verified ID. Sign-in log showed…"
            />
          </div>

          <div className={`ws-field ${invalid('reply')}`}>
            <div className="ws-field-head">
              <label className="ws-field-label" htmlFor={`${ids}-reply`}>
                Reply to {firstName}
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setReply(
                    `Hi ${firstName},\n\nThank you for reaching out. \n\n[What happened and what I did]\n\n[Anything you need to do next]\n\nIf it happens again, just reply to this ticket and we'll pick it straight back up.\n\nKind regards,\nService Desk`,
                  );
                  touched('reply');
                }}
              >
                <FileText size={14} aria-hidden />
                Template
              </button>
            </div>
            <textarea
              id={`${ids}-reply`}
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                touched('reply');
              }}
              rows={4}
              placeholder={`Hi ${firstName}, …`}
            />
          </div>
        </div>

        <div className="ws-res-foot">
          {error && (
            <div className="callout danger small" role="alert">
              <CircleAlert size={16} aria-hidden />
              <div className="callout-body">{error.text}</div>
            </div>
          )}
          <button className="btn btn-primary btn-lg ws-submit" onClick={submit}>
            <CheckCheck size={16} aria-hidden />
            Submit &amp; close ticket
          </button>
        </div>
      </div>
    </aside>
  );
}

type Field = 'rootCause' | 'team' | 'note' | 'reply';
