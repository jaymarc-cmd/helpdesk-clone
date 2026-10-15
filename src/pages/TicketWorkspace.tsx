import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ACTION_BY_ID, TOOL_LABELS, actionsForTool } from '../data/actions';
import { KB_ARTICLES, KB_BY_ID } from '../data/kb';
import { HINT_PENALTY, gradeTicket } from '../engine/scoring';
import { VERIFY_QUESTION_ID, initSession, nextHint, sessionReducer, type SessionState } from '../engine/session';
import { TERMINAL_HELP } from '../engine/terminal';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import { TEAMS, type Outcome, type Scenario, type Team, type TicketAttempt, type ToolId } from '../types';
import { DifficultyDots, Markdown, Modal, PriorityPill, formatClock, initials, useNow } from '../components/ui';

type Tab = 'conversation' | 'directory' | 'endpoint' | 'terminal' | 'kb';

export function TicketWorkspace() {
  const { id = '' } = useParams();
  const { getScenario } = useStore();
  const scenario = getScenario(id);
  if (!scenario) {
    return (
      <div className="card empty">
        <p>Ticket not found.</p>
        <Link to="/tickets" className="btn">
          Back to queue
        </Link>
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

  return (
    <div>
      <div className="ws-header">
        <div>
          <div className="row small mb" style={{ marginBottom: 6 }}>
            <Link to={inShift ? '/shift' : '/tickets'}>← {inShift ? 'Shift board' : 'Queue'}</Link>
            <span className="muted">INC-{(Math.abs(hashCode(scenario.id)) % 90000) + 10000}</span>
            <PriorityPill p={scenario.priority} />
            <span className="pill">{scenario.category}</span>
            <DifficultyDots d={scenario.difficulty} />
            {inShift && <span className="pill pill-danger">Shift</span>}
          </div>
          <h1 style={{ margin: 0 }}>{scenario.title}</h1>
        </div>
        <div className="row">
          {state.settings.hints && (
            <button className="btn btn-sm" onClick={showHint} title={`Costs ${HINT_PENALTY} points`}>
              💡 Hint (−{HINT_PENALTY})
            </button>
          )}
          <span className={`timer ${over ? 'over' : ''}`} title={`Target: ${scenario.targetMinutes} min`}>
            ⏱ {formatClock(elapsed)} <span className="muted small">/ {scenario.targetMinutes}:00</span>
          </span>
        </div>
      </div>

      {hint && (
        <div className="callout warning mb spread">
          <span>
            💡 <strong>Hint:</strong> {hint}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setHint(null)} aria-label="Dismiss hint">
            ✕
          </button>
        </div>
      )}

      <div className="workspace">
        <div className="ws-left stack">
          <TicketInfo scenario={scenario} s={s} onKb={openKb} />
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="tabs" style={{ padding: '0 8px' }}>
            {(
              [
                ['conversation', '💬 Conversation'],
                ['directory', '👤 Directory'],
                ['endpoint', '💻 Endpoint'],
                ['terminal', '⌨️ Terminal'],
                ['kb', '📖 KB'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => openTab(t)}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ padding: 16 }}>
            {tab === 'conversation' && <Conversation scenario={scenario} s={s} dispatch={dispatch} at={at} />}
            {tab === 'directory' && <DirectoryTool scenario={scenario} s={s} dispatch={dispatch} at={at} />}
            {tab === 'endpoint' && <EndpointTool s={s} dispatch={dispatch} at={at} />}
            {tab === 'terminal' && <Terminal s={s} dispatch={dispatch} at={at} />}
            {tab === 'kb' && <KbBrowser related={scenario.kb} onOpen={openKb} />}
          </div>
        </div>

        <ResolutionPanel scenario={scenario} onSubmit={submit} />
      </div>

      {kbOpen && KB_BY_ID[kbOpen] && (
        <Modal onClose={() => setKbOpen(null)}>
          <div className="spread mb">
            <span className="pill">{KB_BY_ID[kbOpen].category}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setKbOpen(null)}>
              ✕ Close
            </button>
          </div>
          <h2>{KB_BY_ID[kbOpen].title}</h2>
          <Markdown text={KB_BY_ID[kbOpen].body} />
        </Modal>
      )}
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

type Dispatch = (e: Parameters<ReturnType<typeof sessionReducer>>[1]) => void;

// ---------------- Left: ticket info ----------------

function TicketInfo({ scenario, s, onKb }: { scenario: Scenario; s: SessionState; onKb: (id: string) => void }) {
  const r = scenario.requester;
  const found = scenario.facts.filter((f) => s.revealed.includes(f.id));
  return (
    <>
      <div className="card">
        <div className="row mb" style={{ marginBottom: 12 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
            {initials(r.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>
              {r.name} {r.vip && <span className="pill pill-warning">VIP</span>}
            </div>
            <div className="tiny muted">{r.title}</div>
          </div>
        </div>
        <dl className="kv">
          <dt>Department</dt>
          <dd>{r.department}</dd>
          <dt>Location</dt>
          <dd>{r.location}</dd>
          <dt>Email</dt>
          <dd className="small">{r.email}</dd>
          <dt>Phone</dt>
          <dd>{r.phone}</dd>
          <dt>Channel</dt>
          <dd style={{ textTransform: 'capitalize' }}>{scenario.channel}</dd>
          <dt>Identity</dt>
          <dd>
            {s.verified ? (
              <span className="pill pill-success">Verified</span>
            ) : s.verifyAttempted ? (
              <span className="pill pill-danger">Failed</span>
            ) : (
              <span className="pill">Not verified</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="card">
        <h3>Findings ({found.length})</h3>
        {found.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Evidence you uncover appears here. Ask questions, check tools, run commands.
          </p>
        ) : (
          <ul className="facts">
            {found.map((f) => (
              <li key={f.id}>{f.label}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Related articles</h3>
        <div className="stack" style={{ gap: 4 }}>
          {scenario.kb.filter((k) => KB_BY_ID[k]).map((k) => (
            <button key={k} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => onKb(k)}>
              📄 {KB_BY_ID[k].title}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Activity log</h3>
        <div className="log">
          {s.log.map((l, i) => (
            <div key={i}>
              [{formatClock(l.at)}] {l.text.length > 90 ? l.text.slice(0, 90) + '…' : l.text}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------- Conversation ----------------

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
      <div className="chat" aria-live="polite">
        {shown.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            {m.from !== 'system' && <span className="who">{m.from === 'agent' ? 'You' : scenario.requester.name}</span>}
            {m.text}
          </div>
        ))}
        {typing && <div className="typing">{firstName} is typing…</div>}
        <div ref={endRef} />
      </div>

      <form
        className="row"
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
          placeholder={`Message ${firstName}… (type your own question)`}
          style={{ flex: 1, width: 'auto' }}
          aria-label="Message"
        />
        <button className="btn btn-primary" disabled={!text.trim() || typing}>
          Send
        </button>
      </form>

      <div>
        <div className="tiny muted mb" style={{ marginBottom: 6 }}>
          SUGGESTED QUESTIONS
        </div>
        <div className="suggestions">
          {!s.verifyAttempted && (
            <button key={VERIFY_QUESTION_ID} className="suggestion verify" disabled={typing} onClick={() => dispatch({ type: 'verify', at: at() })}>
              🔐 Verify identity
            </button>
          )}
          {available.map((q) => (
            <button key={q.id} className="suggestion" disabled={typing} onClick={() => dispatch({ type: 'ask', questionId: q.id, at: at() })}>
              {q.text}
            </button>
          ))}
          {available.length === 0 && s.verifyAttempted && <span className="small muted">No more suggested questions.</span>}
        </div>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🧭 Guided steps (ask {firstName} to do something)</summary>
        <div className="mt">
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
  const destructive = new Set(['reimage', 'remote_restart', 'isolate_device', 'repair_office', 'revoke_sessions']);

  const run = (id: string) => {
    if (destructive.has(id)) setConfirm(id);
    else dispatch({ type: 'action', actionId: id, at: at() });
  };

  return (
    <div className="stack">
      <div className="action-list">
        {actions.map((a) => {
          const done = s.actions.includes(a.id);
          return (
            <button key={a.id} className={`action-btn ${done ? 'done' : ''}`} onClick={() => run(a.id)} title={a.description}>
              <span className="lbl">
                {done ? '✓ ' : ''}
                {a.label}
              </span>
              <span className="desc">{a.description}</span>
              {a.sensitive && !s.verified && <span className="lock">🔒 Requires identity verification</span>}
            </button>
          );
        })}
      </div>
      {results.length > 0 && (
        <div>
          <div className="tiny muted mb" style={{ marginBottom: 6 }}>
            RESULTS
          </div>
          <div className="result-feed">
            {[...results].reverse().map((r, i) => (
              <div key={i} className="result-item">
                <strong>{ACTION_BY_ID[r.id]?.label}:</strong> {r.text}
              </div>
            ))}
          </div>
        </div>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2>Are you sure?</h2>
          <p>
            <strong>{ACTION_BY_ID[confirm].label}</strong>: {ACTION_BY_ID[confirm].description}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
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
              Yes, do it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DirectoryTool({ scenario, s, dispatch, at }: { scenario: Scenario; s: SessionState; dispatch: Dispatch; at: () => number }) {
  const a = s.account;
  const statusTone = a.status === 'Active' ? 'success' : 'danger';
  return (
    <div className="stack">
      <div className="grid grid-2">
        <div className="card card-tight">
          <div className="spread mb" style={{ marginBottom: 8 }}>
            <strong className="mono">{a.username}</strong>
            <span className={`pill pill-${statusTone}`}>{a.status}</span>
          </div>
          {a.statusNote && <div className="callout warning small mb">{a.statusNote}</div>}
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
            <dd>{a.failedLogons}</dd>
            {a.activeSessions !== undefined && (
              <>
                <dt>Sessions</dt>
                <dd>{a.activeSessions} active</dd>
              </>
            )}
          </dl>
        </div>
        <div className="card card-tight">
          <strong>Groups</strong>
          <div className="row mt" style={{ marginTop: 8, gap: 6 }}>
            {a.groups.map((g) => (
              <span key={g} className="pill">
                {g}
              </span>
            ))}
          </div>
          <div className="mt">
            <strong>Mailbox</strong>
            <dl className="kv" style={{ marginTop: 6 }}>
              <dt>Usage</dt>
              <dd>{a.mailboxUsage ?? '—'}</dd>
              <dt>Archive</dt>
              <dd>{a.archive ?? '—'}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="card card-tight">
        <div className="spread">
          <strong>Sign-in log</strong>
          {!s.signInLogViewed && (
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'viewSignInLog', at: at() })}>
              Load sign-in log
            </button>
          )}
        </div>
        {s.signInLogViewed && (
          <pre className="terminal" style={{ height: 'auto', maxHeight: 200, marginTop: 8 }}>
            {(scenario.signInLog?.lines ?? [`${a.lastLogon}  SUCCESS   Windows sign-in   ${s.device.hostname}`, 'No failures in the last 24 hours.']).join('\n')}
          </pre>
        )}
      </div>

      <h3 style={{ marginBottom: 0 }}>{TOOL_LABELS.directory} actions</h3>
      <ActionGrid tool="directory" s={s} dispatch={dispatch} at={at} />
    </div>
  );
}

function EndpointTool({ s, dispatch, at }: { s: SessionState; dispatch: Dispatch; at: () => number }) {
  const d = s.device;
  const powered = !(d.ip === '' && !d.online);
  return (
    <div className="stack">
      <div className="card card-tight">
        <div className="spread mb" style={{ marginBottom: 8 }}>
          <strong className="mono">{d.hostname}</strong>
          <span className="row small">
            <span className={`status-dot ${d.online ? 'ok' : 'bad'}`} />
            {d.online ? 'Online' : powered ? 'Not reachable' : 'Offline / powered off'}
          </span>
        </div>
        <dl className="kv">
          <dt>Model</dt>
          <dd>{d.model}</dd>
          <dt>OS</dt>
          <dd>{d.os}</dd>
          <dt>IP address</dt>
          <dd className="mono">{d.ip || '—'}</dd>
          <dt>Disk free</dt>
          <dd>{d.diskFree}</dd>
          <dt>Uptime</dt>
          <dd>{d.uptime}</dd>
          <dt>Last patch</dt>
          <dd>{d.lastPatch}</dd>
        </dl>
        {d.installedNotes && d.installedNotes.length > 0 && (
          <div className="mt">
            <strong className="small">Inventory &amp; health</strong>
            <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {d.installedNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <h3 style={{ marginBottom: 0 }}>{TOOL_LABELS.endpoint} actions</h3>
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
      <div className="small muted">
        Remote shell on <strong className="mono">{s.device.hostname}</strong>
        {!s.device.online && ' (device is off the network, so the user runs the commands and reads you the results)'}. Type{' '}
        <code>help</code> for commands.
      </div>
      <div className="terminal" ref={boxRef} onClick={() => inputRef.current?.focus()}>
        {s.terminal.length === 0 && <div style={{ opacity: 0.6 }}>Windows PowerShell — remote session established.{'\n\n'}</div>}
        {s.terminal.map((l, i) => (
          <div key={i}>
            <span className="prompt">{prompt}</span> {l.cmd}
            {'\n'}
            {l.output}
            {'\n\n'}
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
  );
}

function KbBrowser({ related, onOpen }: { related: string[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = KB_ARTICLES.filter((a) =>
    q ? `${a.title} ${a.tags.join(' ')} ${a.body}`.toLowerCase().includes(q.toLowerCase()) : true,
  ).sort((a, b) => Number(related.includes(b.id)) - Number(related.includes(a.id)));
  return (
    <div className="stack">
      <input type="search" placeholder="Search the knowledge base…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="stack" style={{ gap: 6 }}>
        {list.map((a) => (
          <button key={a.id} className="action-btn" onClick={() => onOpen(a.id)}>
            <span className="lbl">
              {a.title} {related.includes(a.id) && <span className="pill pill-primary">Related</span>}
            </span>
            <span className="desc">
              {a.category} · {a.tags.slice(0, 4).join(', ')}
            </span>
          </button>
        ))}
      </div>
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
  const [error, setError] = useState('');
  const firstName = scenario.requester.name.split(' ')[0];

  // Shuffle root cause options once so the answer isn't always first.
  const causes = useMemo(() => [...scenario.rootCauses].sort(() => Math.random() - 0.5), [scenario]);

  const submit = () => {
    if (!rootCause) return setError('Choose a root cause.');
    if (outcome === 'escalate' && !team) return setError('Choose the team to escalate to.');
    if (note.trim().length < 10) return setError('Write some work notes first.');
    if (reply.trim().length < 10) return setError(`Write a reply to ${firstName}.`);
    onSubmit({ rootCause, outcome, team: outcome === 'escalate' ? (team as Team) : undefined, note, reply });
  };

  return (
    <div className="card stack" style={{ position: 'sticky', top: 16 }}>
      <h2 style={{ margin: 0 }}>Resolution</h2>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
          Root cause
        </legend>
        <div className="stack" style={{ gap: 6 }}>
          {causes.map((c) => (
            <label key={c.id} className="radio-row">
              <input type="radio" name="rc" checked={rootCause === c.id} onChange={() => setRootCause(c.id)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        Outcome
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
          <option value="resolve">Resolved at tier 1</option>
          <option value="escalate">Escalate to another team</option>
          <option value="pending">Pending (waiting on user)</option>
        </select>
      </label>
      {outcome === 'escalate' && (
        <label className="field">
          Assign to team
          <select value={team} onChange={(e) => setTeam(e.target.value as Team)}>
            <option value="">Select a team…</option>
            {TEAMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        Work notes (internal)
        <span className="hint">Symptom → findings → cause → actions → result</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="e.g. Verified ID. Sign-in log showed…" />
      </label>

      <label className="field">
        <span className="spread">
          Reply to {firstName}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setReply(
                `Hi ${firstName},\n\nThank you for reaching out. \n\n[What happened and what I did]\n\n[Anything you need to do next]\n\nIf it happens again, just reply to this ticket and we'll pick it straight back up.\n\nKind regards,\nService Desk`,
              )
            }
          >
            Template
          </button>
        </span>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} placeholder={`Hi ${firstName}, …`} />
      </label>

      {error && <div className="callout danger small">{error}</div>}
      <button className="btn btn-primary btn-lg" onClick={submit}>
        Submit &amp; close ticket
      </button>
    </div>
  );
}
