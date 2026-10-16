import { useState, type ReactNode } from 'react';
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Camera,
  CircleAlert,
  CircleCheck,
  Download,
  File,
  Folder,
  HardDrive,
  Home,
  Info,
  KeyRound,
  Lock,
  MonitorCog,
  Network,
  Paperclip,
  Power,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { ACTION_BY_ID } from '../../data/actions';
import { Modal } from '../ui';
import type { AppProps } from './Desktop';

// ---------------- shared bits ----------------

function ActionButton({
  id,
  label,
  p,
  danger,
  confirm,
  primary,
}: {
  id: string;
  label: string;
  p: AppProps;
  danger?: boolean;
  confirm?: string;
  primary?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const locked = ACTION_BY_ID[id]?.sensitive && !p.work.session.verified;
  const go = () => (confirm ? setAsking(true) : p.run(id));
  return (
    <>
      <button className={`dt-btn ${primary ? 'primary' : ''} ${danger ? 'danger' : ''}`} onClick={go} title={locked ? 'Requires identity verification' : undefined}>
        {p.done(id) && <CircleCheck size={13} aria-hidden />}
        {label}
      </button>
      {asking && (
        <Modal title="Are you sure?" onClose={() => setAsking(false)}>
          <div className="callout warning">
            <TriangleAlert size={18} aria-hidden />
            <div className="callout-body">{confirm}</div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setAsking(false)} autoFocus>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setAsking(false);
                p.run(id);
              }}
            >
              {label}
            </button>
          </div>
        </Modal>
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

// ---------------- File Explorer ----------------

export function ExplorerApp(p: AppProps) {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const m = d.diskFree.match(/([\d.]+)\s*GB of\s*([\d.]+)/i);
  const free = m ? parseFloat(m[1]) : 100;
  const total = m ? parseFloat(m[2]) : 238;
  const netUse = sc.terminal?.['net use']?.output ?? '';
  const mapped = [...netUse.matchAll(/^(OK|Unavailable)\s+([A-Z]:)\s+(\S+)/gm)].map((x) => ({ status: x[1], letter: x[2], path: x[3] }));
  if (!mapped.some((x) => x.letter === 'H:')) mapped.push({ status: d.online ? 'OK' : 'Unavailable', letter: 'H:', path: `\\\\fs01\\home$\\${p.work.session.account.username}` });
  const fixedF = p.done('guide_restart') || p.done('remote_restart');
  const bigDownloads = sc.facts.some((f) => f.id === 'videos');

  return (
    <div className="dt-app split">
      <nav className="dt-side">
        <span className="on">
          <Home size={14} aria-hidden /> Home
        </span>
        <span>
          <Download size={14} aria-hidden /> Downloads
        </span>
        <span>
          <File size={14} aria-hidden /> Documents
        </span>
        <span>
          <HardDrive size={14} aria-hidden /> This PC
        </span>
      </nav>
      <div className="dt-main">
        <h4>Drives</h4>
        <div className="dt-drive">
          <HardDrive size={22} aria-hidden />
          <div>
            <div>Local Disk (C:)</div>
            <div className="dt-bar">
              <i style={{ width: `${Math.min(100, ((total - free) / total) * 100)}%` }} className={free / total < 0.1 ? 'low' : ''} />
            </div>
            <div className="dt-row-sub">
              {free} GB free of {total} GB
            </div>
          </div>
        </div>
        {mapped.map((x) => {
          const ok = x.status === 'OK' || (x.letter === 'F:' && fixedF);
          return (
            <div key={x.letter} className="dt-drive">
              <Network size={22} aria-hidden />
              <div>
                <div>
                  {x.path.split('\\').filter(Boolean).slice(-1)[0]} ({x.letter})
                </div>
                <div className={`dt-row-sub ${ok ? '' : 'bad'}`}>{ok ? x.path : 'Access is denied'}</div>
              </div>
            </div>
          );
        })}
        <h4>Folders</h4>
        <Row icon={Folder} title="Downloads" sub={bigDownloads ? '97.4 GB · 63 video exports' : '1.2 GB'} />
        <Row icon={Folder} title="Documents" sub="4.8 GB · synced to OneDrive" />
      </div>
    </div>
  );
}

// ---------------- Web Browser ----------------

const INTRANET = 'intranet.hpl.example';

export function BrowserApp(p: AppProps) {
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const scareware = !!sc.actionResults?.guide_close_browser && !p.done('guide_close_browser');
  const dnsHost = Object.keys(sc.terminal ?? {})
    .map((k) => k.match(/^ping (\S+\.hpl\.example)$/)?.[1])
    .find(Boolean);
  const dnsFixed = p.done('flush_dns') || p.done('guide_restart') || p.done('remote_restart');
  const [url, setUrl] = useState(scareware ? 'secure-pc-alert.example/warning' : INTRANET);
  const [input, setInput] = useState(url);
  const go = (u: string) => {
    setUrl(u);
    setInput(u);
  };

  let page: ReactNode;
  if (scareware && url.startsWith('secure-pc-alert')) {
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
      </div>
    );
  } else if (dnsHost && url.includes(dnsHost.split('.')[0]) && !dnsFixed) {
    page = (
      <div className="dt-error">
        <CircleAlert size={32} aria-hidden />
        <h3>This site can't be reached</h3>
        <p>
          {dnsHost} took too long to respond. <span className="mono">ERR_CONNECTION_TIMED_OUT</span>
        </p>
      </div>
    );
  } else if (url === INTRANET) {
    page = (
      <div className="dt-intranet">
        <h3>Harbor &amp; Pine intranet</h3>
        <p>Quick links</p>
        <div className="dt-links">
          {['timesheets.hpl.example', 'crm.hpl.example', 'hr.hpl.example', 'it.hpl.example'].map((l) => (
            <button key={l} onClick={() => go(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    );
  } else {
    page = (
      <div className="dt-intranet">
        <h3>{url}</h3>
        <p>The page loaded normally.</p>
      </div>
    );
  }

  return (
    <div className="dt-app col">
      <form
        className="dt-urlbar"
        onSubmit={(e) => {
          e.preventDefault();
          go(input.trim() || INTRANET);
        }}
      >
        <button type="button" onClick={() => go(INTRANET)} aria-label="Home">
          <ArrowLeft size={14} />
        </button>
        <button type="button" onClick={() => go(url)} aria-label="Reload">
          <RefreshCw size={14} />
        </button>
        <span className="dt-url">
          <Lock size={12} aria-hidden />
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Address" />
        </span>
        <button type="submit" aria-label="Go">
          <ArrowRight size={14} />
        </button>
      </form>
      <div className="dt-page">{page}</div>
    </div>
  );
}

// ---------------- VPN client ----------------

export function VpnApp(p: AppProps) {
  const sc = p.work.scenario;
  const version = versionOf(p, /VPN Client ([\d.]+)/) ?? '5.1.3';
  const outdated = older(version, '5.1');
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const remote = !p.work.session.device.ip.startsWith('10.');
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
        {state === 'ok' && 'Connected to vpn.hpl.example'}
        {state === 'fail' && 'The server certificate could not be validated (0x800B0109).'}
      </div>
      <div className="dt-actions">
        <button className="dt-btn primary" onClick={() => setState(outdated && sc.actionResults?.deploy_vpn ? 'fail' : 'ok')}>
          Connect
        </button>
        {outdated && <ActionButton id="deploy_vpn" label="Install update 5.1.3" p={p} />}
      </div>
      <Result p={p} id="deploy_vpn" />
    </div>
  );
}

// ---------------- Mail ----------------

export function MailApp(p: AppProps) {
  const sc = p.work.scenario;
  const a = p.work.session.account;
  const blocked = /blocked/i.test(a.mailboxUsage ?? '');
  const phishing = sc.facts.some((f) => f.id === 'external_domain');
  const mails = [
    ...(phishing ? [{ from: 'Accounts Team <billing@hpl-invoices-share.co>', subject: 'Shared invoice waiting for your approval', when: '10:47', flag: true }] : []),
    { from: 'IT Service Desk', subject: 'Planned maintenance this weekend', when: 'Yesterday', flag: false },
    { from: 'People & Culture', subject: 'Reminder: annual leave requests', when: 'Mon', flag: false },
    { from: 'Facilities', subject: 'Car park resurfacing on Friday', when: 'Mon', flag: false },
  ];
  return (
    <div className="dt-app col">
      {blocked && (
        <div className="dt-banner bad">
          <CircleAlert size={14} aria-hidden /> Your mailbox is full. You can't send or receive items. ({a.mailboxUsage})
        </div>
      )}
      <div className="dt-mail">
        {mails.map((m) => (
          <div key={m.subject} className={`dt-mail-row ${m.flag ? 'flag' : ''}`}>
            <span className="dt-mail-from">{m.from}</span>
            <span className="dt-mail-subj">
              {m.flag && <Paperclip size={12} aria-hidden />} {m.subject}
            </span>
            <span className="dt-row-sub">{m.when}</span>
          </div>
        ))}
      </div>
      <p className="dt-foot">Mailbox size and archive settings are managed in Directory, on the Mailbox tab.</p>
    </div>
  );
}

// ---------------- Software updates ----------------

export function UpdatesApp(p: AppProps) {
  const vpn = versionOf(p, /VPN Client ([\d.]+)/);
  const dock = versionOf(p, /firmware ([\d.]+)/);
  const items: { id: string; name: string; status: string; available: boolean }[] = [
    { id: 'deploy_vpn', name: 'VPN Client 5.1.3', status: vpn ? `Installed ${vpn}` : 'Installed', available: !!vpn && older(vpn, '5.1') },
    ...(dock ? [{ id: 'update_dock', name: 'USB-C Dock D3 firmware 1.2.1', status: `Installed ${dock}`, available: older(dock, '1.2.1') }] : []),
    { id: 'deploy_office', name: 'Office monthly update', status: 'Up to date', available: false },
    { id: 'deploy_teams', name: 'Teams desktop client', status: 'Up to date', available: false },
    { id: 'deploy_browser', name: 'Browser security update', status: 'Up to date', available: false },
    { id: 'deploy_diagram', name: 'DiagramStudio 3.2 (approved, optional)', status: 'Not installed', available: false },
  ];
  return (
    <div className="dt-app pad">
      <h4>Updates and approved software</h4>
      {items.map((i) => (
        <Row
          key={i.id}
          icon={i.available ? Download : CircleCheck}
          title={i.name}
          sub={p.done(i.id) ? 'Installed just now' : i.available ? `${i.status} · update available` : i.status}
        >
          {!p.done(i.id) && <ActionButton id={i.id} label={i.available ? 'Install' : 'Reinstall'} p={p} primary={i.available} />}
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
  return (
    <div className="dt-app pad">
      <Row
        icon={Printer}
        title="FL2-MFP (default)"
        sub={serverDown ? 'Print server unavailable' : jobs.length ? `${jobs.length} documents waiting` : 'Ready'}
      />
      <h4>Print queue</h4>
      {jobs.length ? (
        <pre className="dt-pre">{[queueOut!.split('\n')[0], ...jobs].join('\n')}</pre>
      ) : (
        <p className="dt-row-sub">{serverDown ? 'Jobs are held: the print server is unavailable.' : 'No documents are waiting.'}</p>
      )}
      <div className="dt-actions">
        <ActionButton id="clear_print_queue" label="Cancel all documents" p={p} />
        <ActionButton id="restart_spooler" label="Restart Print Spooler on this PC" p={p} />
      </div>
      <Result p={p} id="clear_print_queue" />
      <Result p={p} id="restart_spooler" />
    </div>
  );
}

// ---------------- Security ----------------

export function SecurityApp(p: AppProps) {
  return (
    <div className="dt-app pad">
      <div className="dt-vpn-head">
        <ShieldCheck size={34} className="ok" aria-hidden />
        <div>
          <div className="dt-vpn-name">Device is protected</div>
          <div className="dt-row-sub">Definitions updated today · Last scan 3 days ago</div>
        </div>
      </div>
      <div className="dt-actions">
        <ActionButton id="av_scan" label="Run full scan" p={p} primary />
        <ActionButton id="isolate_device" label="Isolate device" p={p} danger confirm="Isolating cuts this device off the network except for the security console." />
      </div>
      <Result p={p} id="av_scan" />
      <Result p={p} id="isolate_device" />
    </div>
  );
}

// ---------------- Recycle bin ----------------

export function TrashApp(_: AppProps) {
  const [empty, setEmpty] = useState(false);
  return (
    <div className="dt-app pad center">
      <Trash2 size={36} aria-hidden />
      <p>{empty ? 'The Recycle Bin is empty.' : '14 items (212 MB)'}</p>
      {!empty && (
        <button className="dt-btn" onClick={() => setEmpty(true)}>
          Empty Recycle Bin
        </button>
      )}
    </div>
  );
}

// ---------------- Settings ----------------

type Section = 'system' | 'network' | 'storage' | 'privacy' | 'credentials' | 'apps' | 'accounts' | 'recovery';
const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'system', label: 'System', icon: MonitorCog },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'privacy', label: 'Privacy & security', icon: Camera },
  { id: 'credentials', label: 'Credential Manager', icon: KeyRound },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'accounts', label: 'Accounts', icon: UserCog },
  { id: 'recovery', label: 'Recovery', icon: RotateCcw },
];

export function SettingsApp(p: AppProps) {
  const [sec, setSec] = useState<Section>('system');
  const sc = p.work.scenario;
  const d = p.work.session.device;
  const cameraOff = !!sc.actionResults?.guide_camera_privacy && sc.requiredActions.includes('guide_camera_privacy') && !p.done('guide_camera_privacy');
  const staleCreds = !!sc.terminal?.['cmdkey /list'] && !p.done('clear_credentials');
  const addinResult = sc.actionResults?.disable_addin?.result ?? '';
  const addinName = addinResult.match(/"([^"]+)"/)?.[1];

  return (
    <div className="dt-app split">
      <nav className="dt-side">
        {SECTIONS.map((s) => (
          <button key={s.id} className={sec === s.id ? 'on' : ''} onClick={() => setSec(s.id)}>
            <s.icon size={14} aria-hidden /> {s.label}
          </button>
        ))}
      </nav>
      <div className="dt-main">
        {sec === 'system' && (
          <>
            <h4>About this device</h4>
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
                <h4>Inventory</h4>
                <ul className="dt-list">
                  {d.installedNotes!.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}
            <h4>Power</h4>
            <Row icon={Power} title="Restart this device" sub="The user loses unsaved work.">
              <ActionButton id="remote_restart" label="Restart" p={p} danger confirm="Restart the device now? The user loses any unsaved work." />
            </Row>
            <Result p={p} id="remote_restart" />
          </>
        )}
        {sec === 'network' && (
          <>
            <h4>Network status</h4>
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
            <h4>Storage</h4>
            <Row icon={HardDrive} title="Local Disk (C:)" sub={`${d.diskFree} free`} />
            <Row icon={Trash2} title="Temporary files and update caches" sub="Safe to remove.">
              <ActionButton id="disk_cleanup" label="Clean up" p={p} primary />
            </Row>
            <Result p={p} id="disk_cleanup" />
          </>
        )}
        {sec === 'privacy' && (
          <>
            <h4>Camera</h4>
            <Row icon={Camera} title="Camera access" sub={cameraOff ? 'Off: apps cannot use the camera' : 'On'}>
              {cameraOff && <ActionButton id="guide_camera_privacy" label="Turn on" p={p} primary />}
            </Row>
            <Result p={p} id="guide_camera_privacy" />
          </>
        )}
        {sec === 'credentials' && (
          <>
            <h4>Windows credentials</h4>
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
            <h4>Office</h4>
            <Row icon={AppWindow} title="Office add-ins" sub={addinName ? `${addinName} (third-party, loads at startup)` : 'No third-party add-ins'}>
              {addinName && <ActionButton id="disable_addin" label="Disable" p={p} />}
            </Row>
            <Result p={p} id="disable_addin" />
            <Row icon={RotateCcw} title="Repair Office" sub="Online repair takes 20 to 40 minutes.">
              <ActionButton id="repair_office" label="Repair" p={p} confirm="Office apps will be unavailable to the user during the repair." />
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
            <h4>Local administrators</h4>
            <Row icon={UserCog} title="HPL\\Workstation Admins" sub="Managed by IT" />
            <Row icon={UserCog} title={`HPL\\${p.work.session.account.username}`} sub="Standard user">
              <ActionButton id="grant_admin" label="Make administrator" p={p} danger confirm="Give this user local admin rights for 24 hours?" />
            </Row>
            <Result p={p} id="grant_admin" />
          </>
        )}
        {sec === 'recovery' && (
          <>
            <h4>Reset this PC</h4>
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
