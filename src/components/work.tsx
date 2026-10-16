import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, CornerDownRight, Inbox, Info, Lock, SquareTerminal, Timer, TriangleAlert } from 'lucide-react';
import { actionLabel } from '../data/actions';
import { TERMINAL_HELP } from '../engine/terminal';
import type { SessionState } from '../engine/session';
import { useStore, type Work } from '../state/store';
import { Modal, PriorityPill, formatClock, ticketNumber, useNow } from './ui';

/** Seconds since the active ticket was assigned. */
export function useElapsed(startedAt: number | undefined): number {
  const now = useNow();
  return startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
}

/** Strip across the top of every app while a ticket is assigned, so you can switch tools and come back. */
export function ActiveTicketBar() {
  const { work } = useStore();
  const { pathname } = useLocation();
  const elapsed = useElapsed(work?.startedAt);
  if (!work) return null;
  const sc = work.scenario;
  const onTicket = pathname === `/ticket/${sc.id}`;
  const over = elapsed > sc.targetMinutes * 60;
  return (
    <div className="wk-bar" role="status" aria-label="Ticket in progress">
      <span className="wk-bar-label">
        <span className="live-dot">WORKING</span>
      </span>
      <span className="wk-bar-ticket">
        <span className="mono">{ticketNumber(sc.id)}</span>
        <PriorityPill p={sc.priority} />
        <span className="wk-bar-title">{sc.title}</span>
      </span>
      <span className="wk-bar-who">{sc.requester.name}</span>
      <span className={`wk-bar-timer ${over ? 'over' : ''}`}>
        <Timer size={14} aria-hidden />
        {formatClock(elapsed)}
      </span>
      {!onTicket && (
        <Link to={`/ticket/${sc.id}`} className="btn btn-sm wk-bar-open">
          Back to ticket
          <ArrowRight size={14} aria-hidden />
        </Link>
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
