import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CornerDownRight,
  Inbox,
  Info,
  Lock,
  MessageSquare,
  Siren,
  SquareTerminal,
  Timer,
  TriangleAlert,
  X,
} from 'lucide-react';
import { actionLabel } from '../data/actions';
import { TERMINAL_HELP } from '../engine/terminal';
import { lastChatAt, quietAllowance, type SessionState } from '../engine/session';
import { MAX_NUDGES } from '../engine/chat';
import { useStore, type Work } from '../state/store';
import { Modal, PriorityPill, formatClock, ticketNumber, useNow } from './ui';
import { currentPriority, loggedPriority } from '../engine/triage';

/** Seconds since the active ticket was assigned. */
export function useElapsed(startedAt: number | undefined): number {
  const now = useNow();
  return startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
}

/** Keeps time moving for one open ticket: the requester chases when left waiting. Renders nothing. */
function WorkClock({ work }: { work: Work }) {
  const elapsed = useElapsed(work.startedAt);
  const s = work.session;
  const sec = Math.floor(elapsed);
  useEffect(() => {
    if (work.hold || s.confirmed || (s.nudges ?? 0) >= MAX_NUDGES) return;
    if (sec - lastChatAt(s) >= quietAllowance(s)) work.emit({ type: 'nudge' });
  }, [sec, work, s]);
  return null;
}

/** Requester messages that have arrived (async replies count once their time comes). */
function arrived(w: Work, elapsedSec: number) {
  return w.session.chat.filter((m) => m.from === 'requester' && (!w.session.async || (m.at ?? 0) <= elapsedSec));
}

/**
 * Strip across the top of every app while tickets are assigned: the focused ticket, tabs for the others,
 * and new messages from requesters while you work elsewhere.
 */
export function ActiveTicketBar() {
  const { works, work } = useStore();
  const { pathname } = useLocation();
  const now = useNow();
  const [seen, setSeen] = useState<Record<string, number>>({});
  const onTicketId = pathname.startsWith('/ticket/') ? pathname.slice('/ticket/'.length) : null;
  const counts = works.map((w) => [w.scenario.id, arrived(w, (now - w.startedAt) / 1000).length] as const);
  const countKey = counts.map((c) => c.join(':')).join(',');

  // Whatever is on screen counts as read.
  useEffect(() => {
    if (!onTicketId) return;
    const c = counts.find(([id]) => id === onTicketId);
    if (c && seen[onTicketId] !== c[1]) setSeen((m) => ({ ...m, [onTicketId]: c[1] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTicketId, countKey]);

  if (!work) return null;
  const unreadOf = (w: Work) => {
    const msgs = arrived(w, (now - w.startedAt) / 1000);
    // A ticket you have never opened since assigning starts with its first message read.
    const read = seen[w.scenario.id] ?? 1;
    return onTicketId === w.scenario.id ? [] : msgs.slice(read);
  };
  const sc = work.scenario;
  const elapsed = Math.max(0, (now - work.startedAt) / 1000);
  const over = elapsed > sc.targetMinutes * 60;
  const unread = unreadOf(work);
  const latest = unread[unread.length - 1];
  const others = works.filter((w) => w !== work);
  return (
    <div className={`wk-bar ${unread.length ? 'has-unread' : ''}`} role="status" aria-label="Tickets in progress">
      {works.map((w) => (
        <WorkClock key={w.scenario.id} work={w} />
      ))}
      <span className="wk-bar-label">
        <span className="live-dot">{work.hold ? 'On hold' : 'Working'}</span>
      </span>
      <span className="wk-bar-ticket">
        <span className="mono">{ticketNumber(sc.id)}</span>
        <PriorityPill p={currentPriority(sc, work.session.triage)} />
        <span className="wk-bar-title">{sc.title}</span>
      </span>
      {latest ? (
        <Link to={`/ticket/${sc.id}`} className="wk-bar-msg" title={latest.text}>
          <MessageSquare size={14} aria-hidden />
          <span className="wk-bar-msg-text">
            <strong>{sc.requester.name.split(' ')[0]}:</strong> {latest.text}
          </span>
          {unread.length > 1 && <span className="wk-bar-count num">{unread.length}</span>}
        </Link>
      ) : (
        <span className="wk-bar-who">{sc.requester.name}</span>
      )}
      <span className={`wk-bar-timer ${over ? 'over' : ''}`}>
        <Timer size={14} aria-hidden />
        {work.hold ? 'Paused' : formatClock(elapsed)}
      </span>
      {onTicketId !== sc.id && (
        <Link to={`/ticket/${sc.id}`} className="btn btn-sm wk-bar-open">
          Back to ticket
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
      {others.length > 0 && (
        <nav className="wk-bar-tabs" aria-label="Other open tickets">
          <span className="wk-bar-tabs-label">Also open</span>
          {others.map((w) => {
            const n = unreadOf(w).length;
            return (
              <Link key={w.scenario.id} to={`/ticket/${w.scenario.id}`} className={`wk-bar-tab ${n ? 'unread' : ''}`} title={w.scenario.title}>
                <span className="mono">{ticketNumber(w.scenario.id)}</span>
                <span>{w.scenario.requester.name.split(' ')[0]}</span>
                {w.hold ? <span className="pill pill-outline">On hold</span> : n > 0 && <span className="wk-bar-count num">{n}</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** Shown in tools when no ticket is assigned, or the record belongs to someone else's ticket. */
export function NoTicketNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="callout info">
      <Info size={18} aria-hidden />
      <div className="callout-body">
        {children ?? (
          <>
            <strong>Read-only.</strong> Changes are recorded against a ticket. Assign yourself a ticket in the{' '}
            <Link to="/tickets">ticket queue</Link> first.
          </>
        )}
      </div>
    </div>
  );
}

/** Banner showing which ticket a tool is acting for. */
export function ActingFor({ work, what }: { work: Work; what: string }) {
  return (
    <div className="wk-acting">
      <Inbox size={14} aria-hidden />
      <span>
        Changes here are recorded on <Link to={`/ticket/${work.scenario.id}`}>{ticketNumber(work.scenario.id)}</Link> ({what}).
      </span>
    </div>
  );
}

export interface ActionItem {
  id: string;
  label: string;
  description?: string;
  /** Needs identity verification first. */
  sensitive?: boolean;
  /** Ask for confirmation before running. */
  destructive?: boolean;
}

/**
 * Buttons that perform actions on the active ticket's session. Each shows its latest result underneath.
 * Pass `disabled` with a reason to render read-only (no ticket, or someone else's record).
 */
export function ActionList({
  items,
  session,
  onRun,
  disabled,
}: {
  items: ActionItem[];
  session: SessionState | null;
  onRun: (id: string) => void;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState<ActionItem | null>(null);
  const resultFor = new Map((session?.actionResults ?? []).map((r) => [r.id, r.text]));
  const latest = session?.actionResults.filter((r) => items.some((i) => i.id === r.id)).slice(-1)[0];

  return (
    <>
      <div className="action-list ws-actions">
        {items.map((a) => {
          const done = !!session?.actions.includes(a.id);
          const result = resultFor.get(a.id);
          const locked = a.sensitive && !session?.verified;
          return (
            <div key={a.id} className={`ws-action ${done ? 'done' : ''}`}>
              <button
                className={`action-btn ${done ? 'done' : ''}`}
                onClick={() => (a.destructive ? setConfirm(a) : onRun(a.id))}
                title={a.description}
                disabled={disabled}
              >
                <span className="lbl">
                  {done && <Check size={14} aria-hidden />}
                  {a.label}
                  {done && <span className="ws-sr"> (done)</span>}
                </span>
                {a.description && <span className="desc">{a.description}</span>}
                {!disabled && (locked || a.destructive) && (
                  <span className="ws-action-flags">
                    {locked && (
                      <span className="lock">
                        <Lock size={12} aria-hidden />
                        Requires identity verification
                      </span>
                    )}
                    {a.destructive && (
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
        {latest ? `${actionLabel(latest.id)}: ${latest.text}` : ''}
      </div>
      {confirm && (
        <Modal title="Confirm action" onClose={() => setConfirm(null)}>
          <div className="stack">
            <div className="callout warning">
              <TriangleAlert size={18} aria-hidden />
              <div className="callout-body">
                <strong>{confirm.label}</strong>
                {confirm.description ? `: ${confirm.description}` : ''}
              </div>
            </div>
            <div className="muted small">This is a disruptive action and is recorded on the ticket. Make sure your findings support it.</div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(null)} autoFocus>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                onRun(confirm.id);
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

/** Remote PowerShell on the active ticket's device. */
export function TerminalPane({ work }: { work: Work }) {
  const s = work.session;
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = `PS C:\\Users\\${s.account.username}>`;

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [s.terminal.length]);

  const run = (raw: string) => work.emit({ type: 'command', raw });

  return (
    <div className="stack">
      {!s.device.online && (
        <div className="callout info small">
          <Info size={16} aria-hidden />
          <div className="callout-body">
            <strong className="mono">{s.device.hostname}</strong> is off the network, so the user runs the commands and reads you the results.
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
              {s.device.online ? 'Windows PowerShell: remote session established. Type help for commands.' : 'Windows PowerShell: relayed session. Type help for commands.'}
              {'\n\n'}
            </div>
          )}
          {s.terminal.map((l, i) => (
            <div key={i} className="ws-term-entry">
              <div className="ws-term-line">
                <span className="prompt">{prompt}</span> {l.cmd}
              </div>
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
              run(cmd);
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
          {TERMINAL_HELP.slice(0, 9).map((h) => {
            const c = h.cmd.replace(/\s*[[<].*$/, '');
            return (
              <button key={h.cmd} className="suggestion mono" onClick={() => run(c)} title={h.desc}>
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SIGNIN_TONE: Record<string, string> = { SUCCESS: 'pill-success', FAILURE: 'pill-danger', LOCKOUT: 'pill-warning' };

/** Column-aligned sign-in log lines rendered as rows that wrap cleanly at any width. */
export function SignInLog({ lines }: { lines: string[] }) {
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

/**
 * Interruptions during a shift: a new ticket arriving, louder when it is urgent or a VIP turns up at your desk.
 * Renders a small stack of alerts in the corner.
 */
export function ShiftAlerts() {
  const { state, getScenario } = useStore();
  const tickets = state.activeShift?.tickets ?? [];
  const [seen, setSeen] = useState(tickets.length);
  const [alerts, setAlerts] = useState<{ id: string; scenarioId: string; title: string; text: string; urgent: boolean }[]>([]);

  useEffect(() => {
    if (!state.activeShift) {
      setSeen(0);
      return;
    }
    if (tickets.length <= seen) return;
    const fresh = tickets.slice(seen).flatMap((t) => {
      const sc = getScenario(t.scenarioId);
      if (!sc) return [];
      const p = loggedPriority(sc);
      const urgent = p === 'P1' || p === 'P2' || !!sc.requester.vip;
      const who = sc.requester.name;
      const title = sc.requester.vip ? `${who} (VIP) is at your desk` : p === 'P1' ? 'P1 just came in' : urgent ? `${p} ticket arrived` : 'New ticket in the queue';
      return [{ id: `${t.scenarioId}-${t.arrivedAt}`, scenarioId: sc.id, title, text: `${ticketNumber(sc.id)} · ${sc.title}`, urgent }];
    });
    setSeen(tickets.length);
    setAlerts((a) => [...a, ...fresh].slice(-3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets.length, !!state.activeShift]);

  // Routine arrivals fade on their own; urgent ones stay until handled or dismissed.
  useEffect(() => {
    if (!alerts.some((a) => !a.urgent)) return;
    const t = setTimeout(() => setAlerts((a) => a.filter((x) => x.urgent)), 8000);
    return () => clearTimeout(t);
  }, [alerts]);

  if (!alerts.length) return null;
  const dismiss = (id: string) => setAlerts((a) => a.filter((x) => x.id !== id));
  return (
    <div className="wk-alerts" aria-live="assertive">
      {alerts.map((a) => (
        <div key={a.id} className={`wk-alert ${a.urgent ? 'urgent' : ''}`} role="alert">
          {a.urgent ? <Siren size={18} aria-hidden /> : <Inbox size={18} aria-hidden />}
          <div className="wk-alert-text">
            <strong>{a.title}</strong>
            <span>{a.text}</span>
          </div>
          <Link to={`/ticket/${a.scenarioId}?mode=shift`} className="btn btn-sm" onClick={() => dismiss(a.id)}>
            Open
          </Link>
          <button className="icon-btn" onClick={() => dismiss(a.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
