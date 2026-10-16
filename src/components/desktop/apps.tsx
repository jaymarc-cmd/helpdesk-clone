import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Bluetooth,
  Camera,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  File,
  FileText,
  Flag,
  Folder,
  HardDrive,
  Home,
  Image,
  Inbox,
  Info,
  KeyRound,
  Keyboard,
  Lock,
  Mail,
  MailOpen,
  Monitor,
  MonitorCog,
  Network,
  Palette,
  Paperclip,
  PenSquare,
  Power,
  Printer,
  RefreshCw,
  Reply,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Undo2,
  UserCog,
  Archive,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { ACTION_BY_ID } from '../../data/actions';
import type { AppProps } from './registry';
import { SIDEBAR, buildFs, folderAt, mappedDrives, type FsItem } from './fs';
import { ACCENTS, Switch, WALLPAPERS, WinDialog } from './shell';

// ---------------- shared bits ----------------

/**
 * A button that performs a ticket action. `busy` shows a progress bar first, like a real install or scan;
 * `confirm` asks in a window dialog first.
 */
function ActionButton({
  id,
  label,
  p,
  danger,
  confirm,
  primary,
  busy,
}: {
  id: string;
  label: string;
  p: AppProps;
  danger?: boolean;
  confirm?: string;
  primary?: boolean;
  busy?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const locked = ACTION_BY_ID[id]?.sensitive && !p.work.session.verified;

  useEffect(() => {
    if (progress === null) return;
    if (progress >= 100) {
      setProgress(null);
      p.run(id);
      return;
    }
    const t = setTimeout(() => setProgress((x) => Math.min(100, (x ?? 0) + 5 + Math.random() * 10)), 110);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const start = () => (busy ? setProgress(0) : p.run(id));
  if (progress !== null)
    return (
      <span className="dt-busy" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={busy}>
        <span className="dt-bar">
          <i style={{ width: `${progress}%` }} />
        </span>
        <span className="num">
          {busy}… {Math.round(progress)}%
        </span>
      </span>
    );
  return (
    <>
      <button
        className={`dt-btn ${primary ? 'primary' : ''} ${danger ? 'danger' : ''}`}
        onClick={() => (confirm ? setAsking(true) : start())}
        title={locked ? 'Requires identity verification' : undefined}
      >
        {p.done(id) && <CircleCheck size={13} aria-hidden />}
        {label}
      </button>
      {asking && (
        <WinDialog
          icon={TriangleAlert}
          tone="warn"
          title="Are you sure?"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="dt-btn" onClick={() => setAsking(false)}>
                Cancel
              </button>
              <button
                className={`dt-btn ${danger ? 'danger-fill' : 'primary'}`}
                onClick={() => {
                  setAsking(false);
                  start();
                }}
              >
                {label}
              </button>
            </>
          }
        >
          {confirm}
        </WinDialog>
      )}
    </>
  );
}

function Result({ p, id }: { p: AppProps; id: string }) {
  const r = p.result(id);
  return r ? <p className="dt-result">{r}</p> : null;
}

function Row({ icon: Icon, title, sub, children }: { icon: LucideIcon; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="dt-row">
      <Icon size={18} className="dt-row-icon" aria-hidden />
      <div className="dt-row-text">
        <div className="dt-row-title">{title}</div>
        {sub && <div className="dt-row-sub">{sub}</div>}
      </div>
      {children && <div className="dt-row-act">{children}</div>}
    </div>
  );
}

const notes = (p: AppProps) => p.work.session.device.installedNotes ?? [];
const versionOf = (p: AppProps, re: RegExp) => notes(p).map((n) => n.match(re)?.[1]).find(Boolean);
const older = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
};
const diskOf = (p: AppProps) => {
  const m = p.work.session.device.diskFree.match(/([\d.]+)\s*GB of\s*([\d.]+)/i);
  return { free: m ? parseFloat(m[1]) : 100, total: m ? parseFloat(m[2]) : 238 };
};

/** Re-run `fn` whenever the window is reopened with an argument. */
function useArg(p: AppProps, fn: (arg: string) => void) {
  useEffect(() => {
    if (p.arg !== undefined && p.argSeq > 0) fn(p.arg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.argSeq]);
}

// ---------------- File Explorer ----------------

const sizeInMb = (s?: string) => {
  const m = s?.match(/([\d.]+)\s*(KB|MB|GB)/);
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2] === 'GB' ? 1024 : m[2] === 'KB' ? 1 / 1024 : 1);
};
const formatMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : mb >= 1 ? `${Math.round(mb)} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`);

function fileIcon(it: FsItem): LucideIcon {
  if (it.kind === 'folder') return Folder;
  if (it.kind === 'drive') return HardDrive;
  if (it.kind === 'net') return Network;
  if (/Video/.test(it.type)) return Video;
  if (/Image/.test(it.type)) return Image;
  if (/Text/.test(it.type)) return FileText;
  return File;
}

export function ExplorerApp(p: AppProps) {
  const fs = useMemo(() => buildFs(p), [p.work.session]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hist, setHist] = useState<{ stack: string[]; i: number }>({ stack: [p.arg ?? 'home'], i: 0 });
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<{ title: string; text: string; bad?: boolean } | null>(null);
  const loc = hist.stack[hist.i];
  const folder = folderAt(fs, loc);
  const drives = mappedDrives(p);

  const go = (to: string) => {
    const f = folderAt(fs, to);
    if (f.denied) {
      setDialog({ title: f.title, text: f.denied, bad: true });
      return;
    }
    setHist((h) => ({ stack: [...h.stack.slice(0, h.i + 1), to], i: h.i + 1 }));
    setSel(null);
    setQ('');
  };
  const step = (n: number) => {
    setHist((h) => ({ ...h, i: Math.min(h.stack.length - 1, Math.max(0, h.i + n)) }));
    setSel(null);
  };
  useArg(p, go);

  const openItem = (it: FsItem) => {
    if (it.to) go(it.to);
    else if (it.text !== undefined) p.open('notepad', `${loc}/${it.name}`);
    else setDialog({ title: it.name, text: `${it.type} files open in their own app, which isn't part of this remote session. Text files open in Notepad.` });
  };

  const items = folder.items.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
  const chain: string[] = [];
  for (let l: string | undefined = loc; l; l = folderAt(fs, l).parent) {
    chain.unshift(l);
    if (chain.length > 6) break;
  }
  const totalMb = items.reduce((a, x) => a + sizeInMb(x.size), 0);
  const selItem = items.find((x) => x.name === sel);

  return (
    <div className="dt-app col dt-explorer">
      <div className="dt-urlbar">
        <button onClick={() => step(-1)} disabled={hist.i === 0} aria-label="Back">
          <ArrowLeft size={14} />
        </button>
        <button onClick={() => step(1)} disabled={hist.i >= hist.stack.length - 1} aria-label="Forward">
          <ArrowRight size={14} />
        </button>
        <button onClick={() => folder.parent && go(folder.parent)} disabled={!folder.parent} aria-label="Up one level">
          <ArrowUp size={14} />
        </button>
        <nav className="dt-crumbs" aria-label="Location">
          {chain.map((l, i) => (
            <span key={l}>
              {i > 0 && <ChevronRight size={12} aria-hidden />}
              <button onClick={() => l !== loc && go(l)}>{folderAt(fs, l).title}</button>
            </span>
          ))}
        </nav>
        <span className="dt-search">
          <Search size={13} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${folder.title}`} aria-label="Search this folder" />
        </span>
      </div>
      <div className="dt-explorer-body">
        <nav className="dt-side">
          {SIDEBAR.map((s) => (
            <button key={s.loc} className={loc === s.loc ? 'on' : ''} onClick={() => go(s.loc)}>
              {s.loc === 'home' ? <Home size={14} aria-hidden /> : s.loc === 'pc' ? <HardDrive size={14} aria-hidden /> : <Folder size={14} aria-hidden />}
              {s.label}
            </button>
          ))}
          <span className="dt-side-label">Network</span>
          {drives.map((x) => (
            <button key={x.letter} className={loc === `net:${x.letter}` ? 'on' : ''} onClick={() => go(`net:${x.letter}`)}>
              <Network size={14} aria-hidden />
              {x.path.split('\\').filter(Boolean).slice(-1)[0]} ({x.letter})
            </button>
          ))}
        </nav>
        <div className="dt-main" onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          {loc === 'pc' ? (
            <>
              <h3 className="dt-h">Devices and drives</h3>
              {items.map((it) => {
                const ok = it.kind !== 'net' || !folderAt(fs, it.to!).denied;
                return (
                  <button key={it.name} className={`dt-drive ${sel === it.name ? 'sel' : ''}`} onClick={() => setSel(it.name)} onDoubleClick={() => openItem(it)}>
                    {it.kind === 'drive' ? <HardDrive size={24} aria-hidden /> : <Network size={24} aria-hidden />}
                    <span>
                      <span className="dt-row-title">{it.name}</span>
                      {it.usage && (
                        <>
                          <span className="dt-bar">
                            <i style={{ width: `${Math.min(100, ((it.usage.total - it.usage.free) / it.usage.total) * 100)}%` }} className={it.usage.free / it.usage.total < 0.1 ? 'low' : ''} />
                          </span>
                          <span className="dt-row-sub">
                            {it.usage.free} GB free of {it.usage.total} GB
                          </span>
                        </>
                      )}
                      {it.kind === 'net' && <span className={`dt-row-sub ${ok ? '' : 'bad'}`}>{ok ? it.type : 'Disconnected · Access is denied'}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          ) : items.length === 0 ? (
            <p className="dt-empty">{q ? 'No items match your search.' : 'This folder is empty.'}</p>
          ) : (
            <div className="dt-files" role="grid" aria-label={folder.title}>
              <div className="dt-files-head" role="row">
                <span>Name</span>
                <span>Date modified</span>
                <span className="dt-hide-sm">Type</span>
                <span className="dt-hide-sm">Size</span>
              </div>
              {items.map((it) => {
                const Icon = fileIcon(it);
                return (
                  <div
                    key={it.name}
                    role="row"
                    tabIndex={0}
                    className={`dt-file ${sel === it.name ? 'sel' : ''}`}
                    onClick={() => setSel(it.name)}
                    onDoubleClick={() => openItem(it)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openItem(it);
                      if (e.key === 'Backspace') step(-1);
                    }}
                  >
                    <span className="dt-file-name">
                      <Icon size={15} className={it.kind === 'folder' ? 'folder' : ''} aria-hidden />
                      {it.name}
                    </span>
                    <span className="dt-row-sub">{it.modified}</span>
                    <span className="dt-row-sub dt-hide-sm">{it.type}</span>
                    <span className="dt-row-sub num dt-hide-sm">{it.size ?? ''}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="dt-status">
        <span className="num">{items.length} items</span>
        {totalMb > 0 && <span className="num">{formatMb(totalMb)}</span>}
        {selItem && <span>1 item selected{selItem.size ? ` · ${selItem.size}` : ''}</span>}
        <span className="dt-status-hint">Double-click to open</span>
      </div>
      {dialog && (
        <WinDialog
          icon={dialog.bad ? CircleAlert : Info}
          tone={dialog.bad ? 'bad' : 'info'}
          title={dialog.title}
          onClose={() => setDialog(null)}
          actions={
            <button className="dt-btn primary" onClick={() => setDialog(null)}>
              OK
            </button>
          }
        >
          {dialog.text}
        </WinDialog>
      )}
    </div>
  );
}

// ---------------- Web Browser ----------------

const INTRANET = 'intranet.hpl.example';
const PHISH_HOST = 'hpl-invoices-share.co';
const clean = (u: string) => u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || INTRANET;

export function BrowserApp(p: AppProps) {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const scareware = !!sc.actionResults?.guide_close_browser && !p.done('guide_close_browser');
  const dnsHost = Object.keys(sc.terminal ?? {})
    .map((k) => k.match(/^ping (\S+\.hpl\.example)$/)?.[1])
    .find(Boolean);
  const dnsFixed = p.done('flush_dns') || p.done('guide_restart') || p.done('remote_restart');
  const start = p.arg ? clean(p.arg) : scareware ? 'secure-pc-alert.example/warning' : INTRANET;
  const [hist, setHist] = useState<{ stack: string[]; i: number }>({ stack: [start], i: 0 });
  const url = hist.stack[hist.i];
  const [input, setInput] = useState(url);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setInput(url);
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 380 + Math.random() * 300);
    return () => clearTimeout(t);
  }, [url, hist.i]);

  const go = (u: string) => setHist((h) => ({ stack: [...h.stack.slice(0, h.i + 1), clean(u)], i: h.i + 1 }));
  const step = (n: number) => setHist((h) => ({ ...h, i: Math.min(h.stack.length - 1, Math.max(0, h.i + n)) }));
  useArg(p, go);
  const host = url.split('/')[0];

  let page: ReactNode;
  if (loading) {
    page = <div className="dt-page-loading" aria-label="Loading" />;
  } else if (scareware && url.startsWith('secure-pc-alert')) {
    page = (
      <div className="dt-scam">
        <ShieldAlert size={40} aria-hidden />
        <h3>Your computer is infected!</h3>
        <p>Call support immediately on 0800-000-000. Do not close this window or your files will be deleted.</p>
        <p className="dt-row-sub">(This is a fake page served by a site the user allowed to send notifications.)</p>
        <ActionButton id="guide_close_browser" label="Close the tab and block this site's notifications" p={p} primary />
      </div>
    );
  } else if (!d.online) {
    page = (
      <div className="dt-error">
        <CircleAlert size={32} aria-hidden />
        <h3>No internet</h3>
        <p>This device isn't connected to a network.</p>
        <button className="dt-btn" onClick={() => step(0)}>
          Try again
        </button>
      </div>
    );
  } else if (host.includes(PHISH_HOST)) {
    page = (
      <div className="dt-scam warn">
        <Ban size={40} aria-hidden />
        <h3>Deceptive site blocked</h3>
        <p>
          <span className="mono">{host}</span> was reported for stealing work passwords. The Harbor &amp; Pine web filter blocked it.
        </p>
        <button className="dt-btn" onClick={() => go(INTRANET)}>
          Back to safety
        </button>
      </div>
    );
  } else if (dnsHost && host === dnsHost && !dnsFixed) {
    page = (
      <div className="dt-error">
        <CircleAlert size={32} aria-hidden />
        <h3>This site can't be reached</h3>
        <p>
          {dnsHost} took too long to respond. <span className="mono">ERR_CONNECTION_TIMED_OUT</span>
        </p>
        <button className="dt-btn" onClick={() => setHist((h) => ({ ...h }))}>
          Reload
        </button>
      </div>
    );
  } else if (host === INTRANET) {
    page = (
      <div className="dt-site">
        <header className="dt-site-hero">
          <h3>Harbor &amp; Pine intranet</h3>
          <p>Good to see you, {(sc.accountOwner?.name ?? sc.requester.name).split(' ')[0]}.</p>
        </header>
        <h3 className="dt-h">Quick links</h3>
        <div className="dt-links">
          {['timesheets.hpl.example', 'it.hpl.example', 'hr.hpl.example', 'crm.hpl.example'].map((l) => (
            <button key={l} onClick={() => go(l)}>
              {l}
            </button>
          ))}
        </div>
        <h3 className="dt-h">News</h3>
        <article className="dt-news">
          <strong>Depot B expansion opens next month</strong>
          <p>Forty new loading bays and a second cold-storage hall. Tours run every Thursday.</p>
        </article>
        <article className="dt-news">
          <strong>Reminder: IT will never ask for your password</strong>
          <p>Report anything suspicious from Mail with the report button, or call extension 4357.</p>
        </article>
      </div>
    );
  } else if (host === 'it.hpl.example') {
    const servers = p.work.session.servers.filter((s) => s.kind === 'server');
    page = (
      <div className="dt-site">
        <header className="dt-site-hero it">
          <h3>IT Service Portal</h3>
          <p>Service status, approved software and self-help.</p>
        </header>
        <h3 className="dt-h">Service status</h3>
        <ul className="dt-status-list">
          {servers.map((s) => (
            <li key={s.id}>
              <span className={`status-dot ${s.status === 'Healthy' ? 'ok' : s.status === 'Degraded' ? 'warn' : 'bad'}`} aria-hidden />
              <span>{s.role}</span>
              <span className="dt-row-sub">{s.status === 'Healthy' ? 'Operational' : s.status}</span>
            </li>
          ))}
        </ul>
        <h3 className="dt-h">Approved software</h3>
        <div className="dt-links">
          {['Office', 'Teams', 'VPN Client', 'DiagramStudio 3.2', 'PDF Reader'].map((s) => (
            <span key={s} className="dt-chip">
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  } else if (host === 'timesheets.hpl.example') {
    page = (
      <div className="dt-site">
        <header className="dt-site-hero">
          <h3>Timesheets</h3>
          <p>Week ending Friday</p>
        </header>
        <div className="dt-timesheet">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
            <label key={day}>
              <span>{day}</span>
              <input type="number" min={0} max={12} defaultValue={7.5} step={0.5} disabled={submitted} />
            </label>
          ))}
        </div>
        <button className="dt-btn primary" onClick={() => setSubmitted(true)} disabled={submitted}>
          {submitted ? 'Submitted for approval' : 'Submit timesheet'}
        </button>
      </div>
    );
  } else {
    page = (
      <div className="dt-site">
        <header className="dt-site-hero plain">
          <h3>{host}</h3>
          <p>{host.endsWith('.hpl.example') ? 'Harbor & Pine internal site' : 'External website'}</p>
        </header>
        <p className="dt-row-sub">The page loaded normally.</p>
      </div>
    );
  }

  const secure = !host.includes(PHISH_HOST) && !host.startsWith('secure-pc-alert');
  return (
    <div className="dt-app col">
      <form
        className="dt-urlbar"
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
      >
        <button type="button" onClick={() => step(-1)} disabled={hist.i === 0} aria-label="Back">
          <ArrowLeft size={14} />
        </button>
        <button type="button" onClick={() => step(1)} disabled={hist.i >= hist.stack.length - 1} aria-label="Forward">
          <ArrowRight size={14} />
        </button>
        <button type="button" onClick={() => setHist((h) => ({ ...h }))} aria-label="Reload">
          <RefreshCw size={14} />
        </button>
        <button type="button" onClick={() => go(INTRANET)} aria-label="Home">
          <Home size={14} />
        </button>
        <span className={`dt-url ${secure ? '' : 'unsafe'}`}>
          {secure ? <Lock size={12} aria-hidden /> : <TriangleAlert size={12} aria-hidden />}
          <input value={input} onChange={(e) => setInput(e.target.value)} onFocus={(e) => e.target.select()} aria-label="Address" />
        </span>
        <button type="submit" aria-label="Go">
          <ArrowRight size={14} />
        </button>
      </form>
      <div className={`dt-loadbar ${loading ? 'on' : ''}`} aria-hidden />
      <div className="dt-page">{page}</div>
    </div>
  );
}

// ---------------- VPN client ----------------

export function VpnApp(p: AppProps) {
  const sc = p.work.scenario;
  const version = versionOf(p, /VPN Client ([\d.]+)/) ?? '5.1.3';
  const outdated = older(version, '5.1');
  const [state, setState] = useState<'idle' | 'connecting' | 'ok' | 'fail'>('idle');
  const remote = !p.work.session.device.ip.startsWith('10.');
  const connect = () => {
    setState('connecting');
    setTimeout(() => setState(outdated && sc.actionResults?.deploy_vpn ? 'fail' : 'ok'), 1100);
  };
  return (
    <div className="dt-app pad">
      <div className="dt-vpn-head">
        <ShieldCheck size={34} aria-hidden />
        <div>
          <div className="dt-vpn-name">HPL Remote Access</div>
          <div className="dt-row-sub">Client version {version}</div>
        </div>
      </div>
      <div className={`dt-vpn-status ${state}`}>
        {state === 'idle' && (remote ? 'Disconnected' : 'Not needed on the office network')}
        {state === 'connecting' && (
          <>
            <span className="dt-spinner small" aria-hidden /> Connecting to vpn.hpl.example…
          </>
        )}
        {state === 'ok' && 'Connected to vpn.hpl.example'}
        {state === 'fail' && 'The server certificate could not be validated (0x800B0109).'}
      </div>
      <div className="dt-actions">
        {state === 'ok' ? (
          <button className="dt-btn" onClick={() => setState('idle')}>
            Disconnect
          </button>
        ) : (
          <button className="dt-btn primary" onClick={connect} disabled={state === 'connecting'}>
            Connect
          </button>
        )}
        {outdated && !p.done('deploy_vpn') && <ActionButton id="deploy_vpn" label="Install update 5.1.3" p={p} busy="Installing" />}
      </div>
      <Result p={p} id="deploy_vpn" />
    </div>
  );
}

// ---------------- Mail ----------------

type MailFolder = 'inbox' | 'sent' | 'archive' | 'deleted';
interface Msg {
  id: string;
  from: string;
  email: string;
  to?: string;
  subject: string;
  when: string;
  body: string;
  folder: MailFolder;
  read: boolean;
  flagged?: boolean;
  external?: boolean;
  link?: { label: string; url: string };
  attachment?: string;
}

function startingMail(phishing: boolean, archived: boolean): Msg[] {
  const list: Msg[] = [];
  if (phishing)
    list.push({
      id: 'phish',
      from: 'Accounts Team',
      email: `billing@${PHISH_HOST}`,
      subject: 'Shared invoice waiting for your approval',
      when: '10:47',
      body: 'Hello,\n\nA shared invoice (INV-20931) is waiting for your approval. Sign in with your work account to review it before 5pm today, or the payment will be delayed.\n\nThank you,\nAccounts Team',
      folder: 'inbox',
      read: true,
      external: true,
      link: { label: 'Review invoice', url: `https://${PHISH_HOST}/sso/login` },
      attachment: 'INV-20931.html',
    });
  list.push(
    {
      id: 'maint',
      from: 'IT Service Desk',
      email: 'servicedesk@hpl.example',
      subject: 'Planned maintenance this weekend',
      when: 'Yesterday',
      body: 'Hi all,\n\nFile and print servers will restart for patching on Saturday between 22:00 and 02:00. Save your work and sign out before you leave on Friday.\n\nIT Service Desk · ext 4357',
      folder: 'inbox',
      read: false,
      link: { label: 'Service status', url: 'it.hpl.example' },
    },
    {
      id: 'leave',
      from: 'People & Culture',
      email: 'people@hpl.example',
      subject: 'Reminder: annual leave requests',
      when: 'Mon',
      body: 'Please submit leave for the holiday period by the end of the month so managers can plan cover.',
      folder: 'inbox',
      read: false,
    },
    {
      id: 'carpark',
      from: 'Facilities',
      email: 'facilities@hpl.example',
      subject: 'Car park resurfacing on Friday',
      when: 'Mon',
      body: 'The staff car park is closed all day Friday. Overflow parking is available at Depot B with a shuttle every 15 minutes.',
      folder: 'inbox',
      read: true,
    },
    {
      id: 'sent1',
      from: 'Me',
      email: '',
      to: 'team@hpl.example',
      subject: 'Re: Weekly sync',
      when: 'Fri',
      body: 'Thanks all, notes attached. Numbers for the regional review are due Friday.',
      folder: 'sent',
      read: true,
    },
  );
  if (archived)
    list.push(
      { id: 'old1', from: 'Finance', email: 'finance@hpl.example', subject: 'Board pack (two years ago)', when: '2 yrs', body: 'Archived message.', folder: 'archive', read: true, attachment: 'Board pack.pdf' },
      { id: 'old2', from: 'Operations', email: 'ops@hpl.example', subject: 'Depot rota (two years ago)', when: '2 yrs', body: 'Archived message.', folder: 'archive', read: true },
    );
  return list;
}

const FOLDERS: { id: MailFolder; label: string; icon: LucideIcon }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent Items', icon: Send },
  { id: 'archive', label: 'Online Archive', icon: Archive },
  { id: 'deleted', label: 'Deleted Items', icon: Trash2 },
];

export function MailApp(p: AppProps) {
  const sc = p.work.scenario;
  const a = p.work.session.account;
  const blocked = /blocked/i.test(a.mailboxUsage ?? '');
  const archiveOn = /^Enabled/i.test(a.archive ?? '');
  const phishing = sc.facts.some((f) => f.id === 'external_domain');
  const [msgs, setMsgs] = useState<Msg[]>(() => startingMail(phishing, archiveOn));
  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [selId, setSelId] = useState<string | null>(null);
  const [hover, setHover] = useState('');
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string; error?: string } | null>(null);
  const [notice, setNotice] = useState('');

  // The archive appears once it is enabled during the ticket.
  useEffect(() => {
    if (archiveOn && !msgs.some((m) => m.folder === 'archive')) setMsgs((ms) => [...ms, ...startingMail(false, true).filter((m) => m.folder === 'archive')]);
  }, [archiveOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = msgs.filter((m) => m.folder === folder);
  const sel = msgs.find((m) => m.id === selId && m.folder === folder);
  const update = (id: string, patch: Partial<Msg>) => setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const unread = (f: MailFolder) => msgs.filter((m) => m.folder === f && !m.read).length;

  const send = () => {
    if (!compose) return;
    if (blocked) {
      setCompose({ ...compose, error: `This message wasn't sent. Your mailbox is full (${a.mailboxUsage}). Delete or archive items, then try again.` });
      return;
    }
    if (!compose.to.trim()) {
      setCompose({ ...compose, error: 'Add at least one recipient.' });
      return;
    }
    setMsgs((ms) => [{ id: `s${Date.now()}`, from: 'Me', email: '', to: compose.to, subject: compose.subject || '(no subject)', when: 'Now', body: compose.body, folder: 'sent', read: true }, ...ms]);
    setCompose(null);
    setNotice('Message sent.');
  };

  return (
    <div className="dt-app col dt-mailapp">
      {blocked && (
        <div className="dt-banner bad">
          <CircleAlert size={14} aria-hidden /> Your mailbox is full. You can't send or receive items. ({a.mailboxUsage})
        </div>
      )}
      <div className="dt-mail-grid">
        <nav className="dt-side">
          <button
            className="dt-btn primary dt-compose-btn"
            onClick={() => {
              setCompose({ to: '', subject: '', body: '' });
              setNotice('');
            }}
          >
            <PenSquare size={14} aria-hidden /> New mail
          </button>
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              className={folder === f.id ? 'on' : ''}
              onClick={() => {
                setFolder(f.id);
                setSelId(null);
                setCompose(null);
              }}
            >
              <f.icon size={14} aria-hidden /> {f.label}
              {unread(f.id) > 0 && <span className="dt-count num">{unread(f.id)}</span>}
            </button>
          ))}
        </nav>
        <div className="dt-mail-list" role="listbox" aria-label={FOLDERS.find((f) => f.id === folder)!.label}>
          {list.length === 0 ? (
            <p className="dt-empty">{folder === 'archive' && !archiveOn ? 'The online archive is not enabled for this mailbox.' : 'Nothing in this folder.'}</p>
          ) : (
            list.map((m) => (
              <button
                key={m.id}
                role="option"
                aria-selected={sel?.id === m.id}
                className={`dt-mail-item ${m.read ? '' : 'unread'} ${sel?.id === m.id ? 'sel' : ''}`}
                onClick={() => {
                  setSelId(m.id);
                  setCompose(null);
                  update(m.id, { read: true });
                }}
              >
                <span className="dt-mail-top">
                  <span className="dt-mail-from">{m.to ? `To: ${m.to}` : m.from}</span>
                  <span className="dt-row-sub">{m.when}</span>
                </span>
                <span className="dt-mail-subj">
                  {m.flagged && <Flag size={11} className="flag" aria-label="Flagged" />}
                  {m.attachment && <Paperclip size={11} aria-label="Attachment" />}
                  {m.subject}
                </span>
                <span className="dt-mail-preview">{m.body.replace(/\n+/g, ' ')}</span>
              </button>
            ))
          )}
        </div>
        <div className="dt-mail-read">
          {compose ? (
            <div className="dt-compose">
              {compose.error && (
                <div className="dt-banner bad">
                  <CircleAlert size={14} aria-hidden /> {compose.error}
                </div>
              )}
              <label>
                <span>To</span>
                <input value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value, error: undefined })} autoFocus />
              </label>
              <label>
                <span>Subject</span>
                <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
              </label>
              <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} aria-label="Message" />
              <div className="dt-actions">
                <button className="dt-btn primary" onClick={send}>
                  <Send size={13} aria-hidden /> Send
                </button>
                <button className="dt-btn" onClick={() => setCompose(null)}>
                  Discard
                </button>
              </div>
            </div>
          ) : sel ? (
            <article className="dt-message">
              <div className="dt-msg-tools">
                <button
                  onClick={() =>
                    setCompose({ to: sel.email || sel.to || '', subject: `Re: ${sel.subject}`, body: `\n\n----- ${sel.from} wrote -----\n${sel.body}` })
                  }
                >
                  <Reply size={13} aria-hidden /> Reply
                </button>
                <button onClick={() => update(sel.id, { flagged: !sel.flagged })}>
                  <Flag size={13} aria-hidden /> {sel.flagged ? 'Unflag' : 'Flag'}
                </button>
                <button onClick={() => update(sel.id, { read: false })}>
                  <MailOpen size={13} aria-hidden /> Mark unread
                </button>
                <button
                  onClick={() => {
                    update(sel.id, { folder: sel.folder === 'deleted' ? 'inbox' : 'deleted' });
                    setSelId(null);
                  }}
                >
                  {sel.folder === 'deleted' ? <Undo2 size={13} aria-hidden /> : <Trash2 size={13} aria-hidden />}
                  {sel.folder === 'deleted' ? 'Restore' : 'Delete'}
                </button>
              </div>
              {sel.external && (
                <div className="dt-banner warn">
                  <TriangleAlert size={14} aria-hidden /> This message came from outside Harbor &amp; Pine. Check the sender before you click links.
                </div>
              )}
              <h3>{sel.subject}</h3>
              <div className="dt-msg-from">
                <span className="dt-avatar small">{sel.from.slice(0, 1)}</span>
                <span>
                  <strong>{sel.from}</strong> {sel.email && <span className="dt-row-sub">&lt;{sel.email}&gt;</span>}
                  <span className="dt-row-sub"> · {sel.when}</span>
                </span>
              </div>
              {sel.attachment && (
                <span className="dt-chip">
                  <Paperclip size={12} aria-hidden /> {sel.attachment}
                </span>
              )}
              <div className="dt-msg-body">
                {sel.body.split('\n').map((line, i) => (
                  <p key={i}>{line || ' '}</p>
                ))}
                {sel.link && (
                  <button
                    className="dt-btn primary"
                    onMouseEnter={() => setHover(sel.link!.url)}
                    onMouseLeave={() => setHover('')}
                    onFocus={() => setHover(sel.link!.url)}
                    onBlur={() => setHover('')}
                    onClick={() => p.open('browser', sel.link!.url)}
                  >
                    {sel.link.label}
                  </button>
                )}
              </div>
            </article>
          ) : (
            <p className="dt-empty">
              <Mail size={28} aria-hidden />
              {notice || 'Select a message to read it.'}
            </p>
          )}
        </div>
      </div>
      <p className="dt-foot">{hover ? <span className="mono">{hover}</span> : 'Mailbox size and archive settings are managed in Directory, on the Mailbox tab.'}</p>
    </div>
  );
}

// ---------------- Software updates ----------------

export function UpdatesApp(p: AppProps) {
  const vpn = versionOf(p, /VPN Client ([\d.]+)/);
  const dock = versionOf(p, /firmware ([\d.]+)/);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState('Today, 06:00');
  const items: { id: string; name: string; status: string; available: boolean }[] = [
    { id: 'deploy_vpn', name: 'VPN Client 5.1.3', status: vpn ? `Installed ${vpn}` : 'Installed', available: !!vpn && older(vpn, '5.1') },
    ...(dock ? [{ id: 'update_dock', name: 'USB-C Dock D3 firmware 1.2.1', status: `Installed ${dock}`, available: older(dock, '1.2.1') }] : []),
    { id: 'deploy_office', name: 'Office monthly update', status: 'Up to date', available: false },
    { id: 'deploy_teams', name: 'Teams desktop client', status: 'Up to date', available: false },
    { id: 'deploy_browser', name: 'Browser security update', status: 'Up to date', available: false },
    { id: 'deploy_diagram', name: 'DiagramStudio 3.2 (approved, optional)', status: 'Not installed', available: false },
  ];
  const pending = items.filter((i) => i.available && !p.done(i.id)).length;
  return (
    <div className="dt-app pad">
      <div className="dt-upd-head">
        <RefreshCw size={30} className={checking ? 'spin' : ''} aria-hidden />
        <div>
          <div className="dt-vpn-name">{checking ? 'Checking for updates…' : pending ? `${pending} update${pending > 1 ? 's' : ''} available` : "You're up to date"}</div>
          <div className="dt-row-sub">Last checked: {checked}</div>
        </div>
        <button
          className="dt-btn"
          disabled={checking}
          onClick={() => {
            setChecking(true);
            setTimeout(() => {
              setChecking(false);
              setChecked('Just now');
            }, 1400);
          }}
        >
          Check for updates
        </button>
      </div>
      <h3 className="dt-h">Updates and approved software</h3>
      {items.map((i) => (
        <Row key={i.id} icon={i.available ? Download : CircleCheck} title={i.name} sub={p.done(i.id) ? 'Installed just now' : i.available ? `${i.status} · update available` : i.status}>
          {!p.done(i.id) && <ActionButton id={i.id} label={i.available ? 'Install' : i.status === 'Not installed' ? 'Install' : 'Reinstall'} p={p} primary={i.available} busy="Installing" />}
        </Row>
      ))}
    </div>
  );
}

// ---------------- Printers ----------------

export function PrintersApp(p: AppProps) {
  const sc = p.work.scenario;
  const queueOut = sc.terminal?.['get-printjob']?.output;
  const cleared = p.done('clear_print_queue');
  const jobs = queueOut && !cleared ? queueOut.split('\n').slice(2).filter(Boolean) : [];
  const printServer = p.work.session.servers.find((s) => s.id === 'PRINT01');
  const serverDown = !!sc.servers?.PRINT01 && printServer?.status !== 'Healthy';
  const [tests, setTests] = useState<number[]>([]);
  const [testMsg, setTestMsg] = useState('');
  // A test page prints when nothing blocks the queue.
  const stuck = serverDown || jobs.length > 0;

  const testPage = () => {
    if (stuck) {
      setTests((t) => [...t, Date.now()]);
      setTestMsg(serverDown ? 'Test page is waiting: the print server is unavailable.' : `Test page queued behind ${jobs.length} documents. Nothing is printing.`);
    } else {
      setTests([]);
      setTestMsg('Test page sent to FL2-MFP. It printed successfully.');
    }
  };

  return (
    <div className="dt-app pad">
      <Row icon={Printer} title="FL2-MFP (default)" sub={serverDown ? 'Print server unavailable' : jobs.length ? `${jobs.length} documents waiting` : 'Ready'}>
        <button className="dt-btn" onClick={testPage}>
          Print test page
        </button>
      </Row>
      {testMsg && <p className={`dt-result ${stuck ? 'warn' : ''}`}>{testMsg}</p>}
      <h3 className="dt-h">Print queue</h3>
      {jobs.length || (stuck && tests.length) ? (
        <pre className="dt-pre">
          {[queueOut?.split('\n')[0] ?? 'Id  Document              Status', ...jobs, ...tests.map((_, i) => `T${i + 1}  Test page             Waiting`)].join('\n')}
        </pre>
      ) : (
        <p className="dt-row-sub">{serverDown ? 'Jobs are held: the print server is unavailable.' : 'No documents are waiting.'}</p>
      )}
      <div className="dt-actions">
        <ActionButton id="clear_print_queue" label="Cancel all documents" p={p} />
        <ActionButton id="restart_spooler" label="Restart Print Spooler on this PC" p={p} busy="Restarting service" />
      </div>
      <Result p={p} id="clear_print_queue" />
      <Result p={p} id="restart_spooler" />
    </div>
  );
}

// ---------------- Security ----------------

export function SecurityApp(p: AppProps) {
  const isolated = p.done('isolate_device');
  return (
    <div className="dt-app pad">
      <div className="dt-vpn-head">
        <ShieldCheck size={34} className={isolated ? '' : 'ok'} aria-hidden />
        <div>
          <div className="dt-vpn-name">{isolated ? 'Device is isolated' : 'Device is protected'}</div>
          <div className="dt-row-sub">Definitions updated today · Last scan {p.done('av_scan') ? 'just now' : '3 days ago'}</div>
        </div>
      </div>
      <Row icon={ShieldCheck} title="Real-time protection" sub="Managed by your organisation">
        <Switch on onChange={() => undefined} label="Real-time protection (managed)" />
      </Row>
      <div className="dt-actions">
        <ActionButton id="av_scan" label="Run full scan" p={p} primary busy="Scanning" />
        <ActionButton id="isolate_device" label="Isolate device" p={p} danger confirm="Isolating cuts this device off the network except for the security console." />
      </div>
      <Result p={p} id="av_scan" />
      <Result p={p} id="isolate_device" />
    </div>
  );
}

// ---------------- Recycle bin ----------------

const BIN = [
  { name: 'Old budget draft.xlsx', from: 'Documents', size: '188 KB' },
  { name: 'Screenshot 2024-03-02.png', from: 'Pictures', size: '1.4 MB' },
  { name: 'setup-log.txt', from: 'Downloads', size: '12 KB' },
  { name: 'Team photo (copy).jpg', from: 'Pictures', size: '3.2 MB' },
  { name: 'Agenda v1.docx', from: 'Documents', size: '44 KB' },
];

export function TrashApp(_: AppProps) {
  const [items, setItems] = useState(BIN);
  const [sel, setSel] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  return (
    <div className="dt-app col">
      <div className="dt-np-bar">
        <button disabled={!sel} onClick={() => setItems((x) => x.filter((i) => i.name !== sel))}>
          <Undo2 size={12} aria-hidden /> Restore
        </button>
        <button disabled={!items.length} onClick={() => setAsking(true)}>
          <Trash2 size={12} aria-hidden /> Empty Recycle Bin
        </button>
      </div>
      {items.length === 0 ? (
        <p className="dt-empty">
          <Trash2 size={30} aria-hidden />
          The Recycle Bin is empty.
        </p>
      ) : (
        <div className="dt-main">
          <div className="dt-files">
            <div className="dt-files-head bin">
              <span>Name</span>
              <span>Original location</span>
              <span className="dt-hide-sm">Size</span>
            </div>
            {items.map((i) => (
              <div key={i.name} tabIndex={0} className={`dt-file bin ${sel === i.name ? 'sel' : ''}`} onClick={() => setSel(i.name)}>
                <span className="dt-file-name">
                  <File size={15} aria-hidden /> {i.name}
                </span>
                <span className="dt-row-sub">{i.from}</span>
                <span className="dt-row-sub num dt-hide-sm">{i.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {asking && (
        <WinDialog
          icon={Trash2}
          tone="warn"
          title="Permanently delete these items?"
          onClose={() => setAsking(false)}
          actions={
            <>
              <button className="dt-btn" onClick={() => setAsking(false)}>
                No
              </button>
              <button
                className="dt-btn primary"
                onClick={() => {
                  setItems([]);
                  setAsking(false);
                }}
              >
                Yes
              </button>
            </>
          }
        >
          {items.length} items will be deleted and can't be recovered.
        </WinDialog>
      )}
    </div>
  );
}

// ---------------- Settings ----------------

type Section = 'system' | 'display' | 'personalize' | 'devices' | 'network' | 'storage' | 'privacy' | 'credentials' | 'apps' | 'accounts' | 'recovery';
export const SETTINGS_SECTIONS: { id: Section; label: string; icon: LucideIcon; keywords: string }[] = [
  { id: 'system', label: 'System', icon: MonitorCog, keywords: 'about device name uptime power restart' },
  { id: 'display', label: 'Display', icon: Monitor, keywords: 'monitor screen brightness night light resolution scale detect' },
  { id: 'personalize', label: 'Personalisation', icon: Palette, keywords: 'wallpaper background colour accent icons theme' },
  { id: 'devices', label: 'Bluetooth & devices', icon: Bluetooth, keywords: 'printer camera dock mouse keyboard' },
  { id: 'network', label: 'Network', icon: Network, keywords: 'ip dns gateway wifi ethernet flush' },
  { id: 'storage', label: 'Storage', icon: HardDrive, keywords: 'disk space cleanup temp' },
  { id: 'privacy', label: 'Privacy & security', icon: Camera, keywords: 'camera microphone permissions' },
  { id: 'credentials', label: 'Credential Manager', icon: KeyRound, keywords: 'passwords saved credentials office' },
  { id: 'apps', label: 'Apps', icon: AppWindow, keywords: 'office add-ins teams cache repair' },
  { id: 'accounts', label: 'Accounts', icon: UserCog, keywords: 'administrator admin users' },
  { id: 'recovery', label: 'Recovery', icon: RotateCcw, keywords: 'reset reimage reinstall' },
];

function DisplaySection(p: AppProps) {
  const d = p.work.session.device;
  const dock = versionOf(p, /firmware ([\d.]+)/);
  const dockOk = !dock || !older(dock, '1.2.1');
  const desktop = /Desktop/i.test(d.model);
  const monitors = desktop
    ? [{ n: 1, name: 'Monitor (DisplayPort)' }]
    : [{ n: 1, name: 'Built-in display' }, ...(dock ? [{ n: 2, name: 'Dock DisplayPort 1' }, ...(dockOk ? [{ n: 3, name: 'Dock DisplayPort 2' }] : [])] : [])];
  const [sel, setSel] = useState(1);
  const [detect, setDetect] = useState<'idle' | 'busy' | 'done'>('idle');
  const [identify, setIdentify] = useState(false);
  const [scale, setScale] = useState('125%');
  const [res, setRes] = useState('1920 × 1080 (recommended)');

  return (
    <>
      <h3 className="dt-h">Arrange your displays</h3>
      <div className="dt-monitors">
        {monitors.map((m) => (
          <button key={m.n} className={`dt-monitor ${sel === m.n ? 'on' : ''} ${identify ? 'identify' : ''}`} onClick={() => setSel(m.n)} aria-pressed={sel === m.n}>
            <span className="dt-monitor-n">{m.n}</span>
          </button>
        ))}
      </div>
      <div className="dt-actions">
        <button
          className="dt-btn"
          onClick={() => {
            setIdentify(true);
            setTimeout(() => setIdentify(false), 1500);
          }}
        >
          Identify
        </button>
        <button
          className="dt-btn"
          disabled={detect === 'busy'}
          onClick={() => {
            setDetect('busy');
            setTimeout(() => setDetect('done'), 1300);
          }}
        >
          {detect === 'busy' && <span className="dt-spinner small" aria-hidden />}
          Detect
        </button>
      </div>
      {detect === 'done' && (
        <p className={`dt-result ${dock && !dockOk ? 'warn' : ''}`}>
          {dock && !dockOk ? "Didn't detect another display on Dock DisplayPort 2. The dock reports firmware " + dock + '.' : 'All connected displays are detected.'}
        </p>
      )}
      <h3 className="dt-h">{monitors.find((m) => m.n === sel)?.name ?? 'Display'}</h3>
      <Row icon={Monitor} title="Display resolution">
        <select className="dt-select" value={res} onChange={(e) => setRes(e.target.value)} aria-label="Display resolution">
          {['2560 × 1440', '1920 × 1080 (recommended)', '1600 × 900', '1280 × 720'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Row>
      <Row icon={Monitor} title="Scale">
        <select className="dt-select" value={scale} onChange={(e) => setScale(e.target.value)} aria-label="Scale">
          {['100%', '125%', '150%', '175%'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Row>
      <Row icon={Monitor} title="Brightness" sub={`${p.prefs.brightness}%`}>
        <input type="range" min={30} max={100} value={p.prefs.brightness} onChange={(e) => p.setPref('brightness', Number(e.target.value))} aria-label="Brightness" />
      </Row>
      <Row icon={Monitor} title="Night light" sub="Warmer colours to help you sleep">
        <Switch on={p.prefs.nightLight} onChange={(v) => p.setPref('nightLight', v)} label="Night light" />
      </Row>
    </>
  );
}

function PersonalizeSection(p: AppProps) {
  return (
    <>
      <h3 className="dt-h">Background</h3>
      <div className="dt-wp-grid">
        {WALLPAPERS.map((w) => (
          <button key={w.id} className={`dt-wp ${p.prefs.wallpaper === w.id ? 'on' : ''}`} onClick={() => p.setPref('wallpaper', w.id)} aria-pressed={p.prefs.wallpaper === w.id}>
            <span className={`dt-wallpaper wp-${w.id}`} aria-hidden />
            <span className="dt-wp-label">{w.label}</span>
          </button>
        ))}
      </div>
      <h3 className="dt-h">Accent colour</h3>
      <div className="dt-swatches">
        {ACCENTS.map((c) => (
          <button key={c} className={`dt-swatch ${p.prefs.accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => p.setPref('accent', c)} aria-label={`Accent ${c}`} aria-pressed={p.prefs.accent === c} />
        ))}
      </div>
      <h3 className="dt-h">Desktop icons</h3>
      <Row icon={AppWindow} title="Show desktop icons">
        <Switch on={p.prefs.showIcons} onChange={(v) => p.setPref('showIcons', v)} label="Show desktop icons" />
      </Row>
      <Row icon={AppWindow} title="Icon size">
        <select className="dt-select" value={p.prefs.iconSize} onChange={(e) => p.setPref('iconSize', e.target.value as typeof p.prefs.iconSize)} aria-label="Icon size">
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </Row>
    </>
  );
}

export function SettingsApp(p: AppProps) {
  const [sec, setSec] = useState<Section>(() => (SETTINGS_SECTIONS.some((s) => s.id === p.arg) ? (p.arg as Section) : 'system'));
  useArg(p, (a) => SETTINGS_SECTIONS.some((s) => s.id === a) && setSec(a as Section));
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const cameraOff = !!sc.actionResults?.guide_camera_privacy && sc.requiredActions.includes('guide_camera_privacy') && !p.done('guide_camera_privacy');
  const staleCreds = !!sc.terminal?.['cmdkey /list'] && !p.done('clear_credentials');
  const addinResult = sc.actionResults?.disable_addin?.result ?? '';
  const addinName = addinResult.match(/"([^"]+)"/)?.[1];
  const dock = versionOf(p, /firmware ([\d.]+)/);
  const { free, total } = diskOf(p);
  const used = total - free;
  const videos = sc.facts.some((f) => f.id === 'videos');
  const temp = sc.facts.some((f) => f.id === 'temp') && !p.done('disk_cleanup');
  const usage = [
    { label: 'System & reserved', gb: 34 },
    { label: 'Apps', gb: 28 },
    { label: 'Temporary files', gb: temp ? 14 : 1.2 },
    { label: 'Downloads', gb: videos ? 97.4 : 1.2 },
    { label: 'Documents', gb: 4.8 },
  ];
  const other = Math.max(0, used - usage.reduce((a, x) => a + x.gb, 0));

  return (
    <div className="dt-app split">
      <nav className="dt-side">
        {SETTINGS_SECTIONS.map((s) => (
          <button key={s.id} className={sec === s.id ? 'on' : ''} onClick={() => setSec(s.id)}>
            <s.icon size={14} aria-hidden /> {s.label}
          </button>
        ))}
      </nav>
      <div className="dt-main" key={sec}>
        {sec === 'system' && (
          <>
            <h3 className="dt-h">About this device</h3>
            <dl className="dt-kv">
              <dt>Device name</dt>
              <dd className="mono">{d.hostname}</dd>
              <dt>Model</dt>
              <dd>{d.model}</dd>
              <dt>Edition</dt>
              <dd>{d.os}</dd>
              <dt>Uptime</dt>
              <dd>{d.uptime}</dd>
              <dt>Last update</dt>
              <dd>{d.lastPatch}</dd>
            </dl>
            {(d.installedNotes ?? []).length > 0 && (
              <>
                <h3 className="dt-h">Inventory</h3>
                <ul className="dt-list">
                  {d.installedNotes!.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="dt-h">Power</h3>
            <Row icon={Power} title="Restart this device" sub="The user loses unsaved work.">
              <ActionButton id="remote_restart" label="Restart" p={p} danger confirm="Restart the device now? The user loses any unsaved work." />
            </Row>
            <Result p={p} id="remote_restart" />
          </>
        )}
        {sec === 'display' && <DisplaySection {...p} />}
        {sec === 'personalize' && <PersonalizeSection {...p} />}
        {sec === 'devices' && (
          <>
            <h3 className="dt-h">Devices</h3>
            <Row icon={Bluetooth} title="Bluetooth" sub={p.prefs.bluetooth ? 'On · discoverable as ' + d.hostname : 'Off'}>
              <Switch on={p.prefs.bluetooth} onChange={(v) => p.setPref('bluetooth', v)} label="Bluetooth" />
            </Row>
            <Row icon={Printer} title="Printers & scanners" sub="FL2-MFP (default)">
              <button className="dt-btn" onClick={() => p.open('printers')}>
                Open
              </button>
            </Row>
            <Row icon={Camera} title="Integrated camera" sub={cameraOff ? 'Blocked by privacy settings' : 'Working'}>
              {cameraOff && (
                <button className="dt-btn" onClick={() => setSec('privacy')}>
                  Camera privacy
                </button>
              )}
            </Row>
            {dock && <Row icon={Monitor} title="USB-C Dock D3" sub={`Firmware ${dock}${older(dock, '1.2.1') ? ' · update available' : ''}`} />}
            <Row icon={Keyboard} title="Keyboard and mouse" sub="Connected" />
          </>
        )}
        {sec === 'network' && (
          <>
            <h3 className="dt-h">Network status</h3>
            <div className={`dt-banner ${d.online ? 'ok' : 'bad'}`}>{d.online ? 'Connected' : 'Not connected: no network access'}</div>
            <dl className="dt-kv">
              <dt>IPv4 address</dt>
              <dd className="mono">{d.ip || 'None'}</dd>
              <dt>Default gateway</dt>
              <dd className="mono">{d.gateway || 'None'}</dd>
              <dt>DNS server</dt>
              <dd className="mono">{d.dns || 'None'}</dd>
            </dl>
            <Row icon={RefreshCw} title="Clear the DNS cache" sub="Forgets cached website addresses.">
              <ActionButton id="flush_dns" label="Flush DNS" p={p} />
            </Row>
            <Result p={p} id="flush_dns" />
          </>
        )}
        {sec === 'storage' && (
          <>
            <h3 className="dt-h">Local Disk (C:)</h3>
            <div className="dt-stack" aria-label={`${used.toFixed(1)} GB used of ${total} GB`}>
              {[...usage, { label: 'Other', gb: other }].map((u, i) => (
                <i key={u.label} className={`c${i}`} style={{ width: `${(u.gb / total) * 100}%` }} title={`${u.label}: ${u.gb.toFixed(1)} GB`} />
              ))}
            </div>
            <p className={`dt-row-sub ${free / total < 0.1 ? 'bad' : ''}`}>
              {used.toFixed(1)} GB used · {free} GB free of {total} GB
            </p>
            <ul className="dt-legend">
              {[...usage, { label: 'Other', gb: other }].map((u, i) => (
                <li key={u.label}>
                  <i className={`c${i}`} aria-hidden />
                  <span>{u.label}</span>
                  <span className="num">{u.gb.toFixed(1)} GB</span>
                </li>
              ))}
            </ul>
            <Row icon={Trash2} title="Temporary files and update caches" sub="Safe to remove.">
              <ActionButton id="disk_cleanup" label="Clean up" p={p} primary busy="Cleaning" />
            </Row>
            <Result p={p} id="disk_cleanup" />
            {videos && (
              <Row icon={Folder} title="Downloads" sub="Large personal files. Ask the user before moving or deleting anything.">
                <button className="dt-btn" onClick={() => p.open('explorer', 'downloads')}>
                  View
                </button>
              </Row>
            )}
          </>
        )}
        {sec === 'privacy' && (
          <>
            <h3 className="dt-h">Camera</h3>
            <Row icon={Camera} title="Camera access" sub={cameraOff ? 'Off: apps cannot use the camera' : 'On'}>
              {cameraOff ? <ActionButton id="guide_camera_privacy" label="Turn on" p={p} primary /> : <Switch on onChange={() => undefined} label="Camera access" />}
            </Row>
            <Result p={p} id="guide_camera_privacy" />
          </>
        )}
        {sec === 'credentials' && (
          <>
            <h3 className="dt-h">Windows credentials</h3>
            {staleCreds && (
              <>
                <Row icon={KeyRound} title="MicrosoftOffice16_Data:SSPI" sub="Last updated 41 days ago" />
                <Row icon={KeyRound} title="MicrosoftOffice16_Data:orgid" sub="Last updated 41 days ago" />
              </>
            )}
            <Row icon={KeyRound} title="msteams_adalsso" sub="Updated today" />
            <div className="dt-actions">
              <ActionButton id="clear_credentials" label="Remove saved Office credentials" p={p} />
            </div>
            <Result p={p} id="clear_credentials" />
          </>
        )}
        {sec === 'apps' && (
          <>
            <h3 className="dt-h">Office</h3>
            <Row icon={AppWindow} title="Office add-ins" sub={addinName ? `${addinName} (third-party, loads at startup)` : 'No third-party add-ins'}>
              {addinName && <ActionButton id="disable_addin" label="Disable" p={p} />}
            </Row>
            <Result p={p} id="disable_addin" />
            <Row icon={RotateCcw} title="Repair Office" sub="Online repair takes 20 to 40 minutes.">
              <ActionButton id="repair_office" label="Repair" p={p} confirm="Office apps will be unavailable to the user during the repair." busy="Repairing" />
            </Row>
            <Result p={p} id="repair_office" />
            <Row icon={Trash2} title="Teams cache" sub="Clears local Teams data.">
              <ActionButton id="clear_teams_cache" label="Clear" p={p} />
            </Row>
            <Result p={p} id="clear_teams_cache" />
          </>
        )}
        {sec === 'accounts' && (
          <>
            <h3 className="dt-h">Local administrators</h3>
            <Row icon={UserCog} title="HPL\\Workstation Admins" sub="Managed by IT" />
            <Row icon={UserCog} title={`HPL\\${p.work.session.account.username}`} sub="Standard user">
              <ActionButton id="grant_admin" label="Make administrator" p={p} danger confirm="Give this user local admin rights for 24 hours?" />
            </Row>
            <Result p={p} id="grant_admin" />
          </>
        )}
        {sec === 'recovery' && (
          <>
            <h3 className="dt-h">Reset this PC</h3>
            <div className="dt-banner bad">
              <Info size={14} aria-hidden /> Reimaging wipes the device and reinstalls the standard build. Local files are lost.
            </div>
            <div className="dt-actions">
              <ActionButton id="reimage" label="Reimage device" p={p} danger confirm="Wipe this device and reinstall the standard build? All local data is lost." />
            </div>
            <Result p={p} id="reimage" />
          </>
        )}
      </div>
    </div>
  );
}

