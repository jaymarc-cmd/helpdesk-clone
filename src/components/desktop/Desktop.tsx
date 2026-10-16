import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  Battery,
  Folder,
  Globe,
  Mail,
  Maximize2,
  Minimize2,
  Minus,
  MonitorSmartphone,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldHalf,
  SquareTerminal,
  Trash2,
  Unplug,
  Volume2,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { actionLabel } from '../../data/actions';
import type { Work } from '../../state/store';
import { BrowserApp, ExplorerApp, MailApp, PrintersApp, SecurityApp, SettingsApp, TrashApp, UpdatesApp, VpnApp } from './apps';
import { TerminalPane } from '../work';
import '../../styles/desktop.css';

export type AppId = 'explorer' | 'browser' | 'vpn' | 'mail' | 'updates' | 'printers' | 'security' | 'terminal' | 'settings' | 'trash';

export interface AppDef {
  id: AppId;
  title: string;
  icon: LucideIcon;
  tone: string;
  width: number;
  height: number;
}

export const APPS: AppDef[] = [
  { id: 'explorer', title: 'File Explorer', icon: Folder, tone: 'amber', width: 620, height: 400 },
  { id: 'browser', title: 'Web Browser', icon: Globe, tone: 'teal', width: 720, height: 460 },
  { id: 'vpn', title: 'VPN Client', icon: ShieldHalf, tone: 'indigo', width: 440, height: 400 },
  { id: 'mail', title: 'Mail', icon: Mail, tone: 'sky', width: 660, height: 420 },
  { id: 'updates', title: 'Software Updates', icon: RefreshCw, tone: 'coral', width: 560, height: 440 },
  { id: 'printers', title: 'Printers', icon: Printer, tone: 'slate', width: 560, height: 400 },
  { id: 'security', title: 'Security', icon: ShieldCheck, tone: 'green', width: 480, height: 380 },
  { id: 'terminal', title: 'PowerShell', icon: SquareTerminal, tone: 'ink', width: 700, height: 460 },
  { id: 'settings', title: 'Settings', icon: Settings, tone: 'graphite', width: 720, height: 480 },
  { id: 'trash', title: 'Recycle Bin', icon: Trash2, tone: 'glass', width: 420, height: 280 },
];
const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;
const PINNED: AppId[] = ['explorer', 'browser', 'mail', 'terminal', 'settings'];

interface Win {
  app: AppId;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

/** Props every desktop app receives. `run` performs a ticket action and pops a notification. */
export interface AppProps {
  work: Work;
  run: (actionId: string) => void;
  /** Latest result text for an action, if it was performed. */
  result: (actionId: string) => string | undefined;
  done: (actionId: string) => boolean;
  open: (app: AppId) => void;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="dt-clock">
      <span>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
      <span>{now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
    </div>
  );
}

/**
 * A simulated remote desktop on the ticket's device. Each app maps its buttons to ticket actions,
 * so fixing things here is graded exactly like any other tool.
 */
export function Desktop({ work, onDisconnect }: { work: Work; onDisconnect: () => void }) {
  const d = work.session.device;
  const areaRef = useRef<HTMLDivElement>(null);
  const [wins, setWins] = useState<Win[]>([]);
  const [startOpen, setStartOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; text: string; key: number } | null>(null);
  const [full, setFull] = useState(false);
  const zTop = useRef(10);
  const lastCount = useRef(work.session.actionResults.length);

  // Pop a notification for every new action result produced from the desktop.
  useEffect(() => {
    const rs = work.session.actionResults;
    if (rs.length > lastCount.current) {
      const r = rs[rs.length - 1];
      // Guided-step actions are worded for the user; done remotely they are just a settings change.
      setToast({ title: r.id.startsWith('guide_') ? 'Change applied' : actionLabel(r.id), text: r.text, key: Date.now() });
    }
    lastCount.current = rs.length;
  }, [work.session.actionResults]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const focus = (app: AppId) =>
    setWins((ws) => ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false } : w)));

  const open = (app: AppId) => {
    setStartOpen(false);
    setWins((ws) => {
      if (ws.some((w) => w.app === app)) return ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false } : w));
      const area = areaRef.current?.getBoundingClientRect();
      const def = APP_BY_ID[app];
      const n = ws.length;
      const maxX = Math.max(0, (area?.width ?? 900) - def.width - 8);
      const maxY = Math.max(0, (area?.height ?? 560) - def.height - 8);
      return [...ws, { app, x: Math.min(maxX, 150 + n * 28), y: Math.min(maxY, 24 + n * 26), z: ++zTop.current, minimized: false, maximized: false }];
    });
  };
  const close = (app: AppId) => setWins((ws) => ws.filter((w) => w.app !== app));
  const toggleMin = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, minimized: !w.minimized } : w)));
  const toggleMax = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, maximized: !w.maximized, z: ++zTop.current } : w)));

  const startDrag = (app: AppId, e: ReactPointerEvent) => {
    const w = wins.find((x) => x.app === app);
    const area = areaRef.current?.getBoundingClientRect();
    if (!w || !area || w.maximized || (e.target as HTMLElement).closest('button')) return;
    focus(app);
    const def = APP_BY_ID[app];
    const ox = e.clientX - w.x;
    const oy = e.clientY - w.y;
    const move = (ev: PointerEvent) => {
      const x = Math.min(Math.max(-def.width + 120, ev.clientX - ox), area.width - 120);
      const y = Math.min(Math.max(0, ev.clientY - oy), area.height - 40);
      setWins((ws) => ws.map((v) => (v.app === app ? { ...v, x, y } : v)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const resultFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of work.session.actionResults) m.set(r.id, r.text);
    return m;
  }, [work.session.actionResults]);

  const props: AppProps = {
    work,
    run: (id) => work.emit({ type: 'action', actionId: id }),
    result: (id) => resultFor.get(id),
    done: (id) => work.session.actions.includes(id),
    open,
  };

  const content = (app: AppId): ReactNode => {
    switch (app) {
      case 'explorer':
        return <ExplorerApp {...props} />;
      case 'browser':
        return <BrowserApp {...props} />;
      case 'vpn':
        return <VpnApp {...props} />;
      case 'mail':
        return <MailApp {...props} />;
      case 'updates':
        return <UpdatesApp {...props} />;
      case 'printers':
        return <PrintersApp {...props} />;
      case 'security':
        return <SecurityApp {...props} />;
      case 'terminal':
        return (
          <div className="ws-root dt-term">
            <TerminalPane work={work} />
          </div>
        );
      case 'settings':
        return <SettingsApp {...props} />;
      case 'trash':
        return <TrashApp {...props} />;
    }
  };

  const topApp = [...wins].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.app;

  return (
    <div className={`dt-frame ${full ? 'full' : ''}`}>
      <div className="dt-titlebar">
        <span className="dt-title">
          <MonitorSmartphone size={14} aria-hidden />
          <span className="mono">{d.hostname}</span>
          <span className="dt-title-sep">·</span>
          {work.scenario.accountOwner?.name ?? work.scenario.requester.name}
        </span>
        <span className="dt-title-actions">
          <button className="dt-plain" onClick={() => setFull((f) => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'}>
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="dt-plain dt-disconnect" onClick={onDisconnect}>
            <Unplug size={14} aria-hidden />
            Disconnect
          </button>
        </span>
      </div>

      <div className="dt-screen" ref={areaRef} onPointerDown={() => setStartOpen(false)}>
        <div className="dt-wallpaper" aria-hidden />
        <div className="dt-icons" role="list" aria-label="Desktop">
          {APPS.map((a) => (
            <button key={a.id} className="dt-icon" role="listitem" onDoubleClick={() => open(a.id)} onClick={() => open(a.id)} title={`Open ${a.title}`}>
              <span className={`dt-tile tone-${a.tone}`}>
                <a.icon size={26} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="dt-icon-label">{a.title}</span>
            </button>
          ))}
        </div>

        {wins.map((w) => {
          const def = APP_BY_ID[w.app];
          return (
            <section
              key={w.app}
              className={`dt-win ${w.maximized ? 'max' : ''} ${topApp === w.app ? 'active' : ''}`}
              style={{ left: w.x, top: w.y, width: def.width, height: def.height, zIndex: w.z, display: w.minimized ? 'none' : undefined }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (topApp !== w.app) focus(w.app);
              }}
              aria-label={def.title}
            >
              <header className="dt-win-bar" onPointerDown={(e) => startDrag(w.app, e)} onDoubleClick={() => toggleMax(w.app)}>
                <span className="dt-win-title">
                  <span className={`dt-tile mini tone-${def.tone}`}>
                    <def.icon size={12} aria-hidden />
                  </span>
                  {def.title}
                </span>
                <span className="dt-win-ctl">
                  <button onClick={() => toggleMin(w.app)} aria-label="Minimise">
                    <Minus size={14} />
                  </button>
                  <button onClick={() => toggleMax(w.app)} aria-label={w.maximized ? 'Restore' : 'Maximise'}>
                    {w.maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  <button className="close" onClick={() => close(w.app)} aria-label="Close">
                    <X size={14} />
                  </button>
                </span>
              </header>
              <div className="dt-win-body">{content(w.app)}</div>
            </section>
          );
        })}

        {startOpen && (
          <div className="dt-start" onPointerDown={(e) => e.stopPropagation()}>
            <div className="dt-start-search">
              <Search size={14} aria-hidden />
              <span>Type to search apps</span>
            </div>
            <div className="dt-start-grid">
              {APPS.map((a) => (
                <button key={a.id} onClick={() => open(a.id)}>
                  <span className={`dt-tile small tone-${a.tone}`}>
                    <a.icon size={18} aria-hidden />
                  </span>
                  <span>{a.title}</span>
                </button>
              ))}
            </div>
            <div className="dt-start-foot">
              <span className="mono">{work.session.account.username}</span>
              <button
                onClick={() => {
                  setStartOpen(false);
                  open('settings');
                }}
              >
                Power and restart options
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="dt-toast" key={toast.key} role="status" onClick={() => setToast(null)}>
            <strong>{toast.title}</strong>
            <span>{toast.text}</span>
          </div>
        )}
      </div>

      <div className="dt-taskbar">
        <div className="dt-task-left" />
        <div className="dt-task-center">
          <button className={`dt-task start ${startOpen ? 'on' : ''}`} onClick={() => setStartOpen((s) => !s)} aria-label="Start">
            <span className="dt-start-logo" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>
          {[...new Set([...PINNED, ...wins.map((w) => w.app)])].map((id) => {
            const a = APP_BY_ID[id];
            const w = wins.find((x) => x.app === id);
            return (
              <button
                key={id}
                className={`dt-task ${w ? 'running' : ''} ${topApp === id ? 'on' : ''}`}
                onClick={() => (w && topApp === id ? toggleMin(id) : open(id))}
                aria-label={a.title}
                title={a.title}
              >
                <span className={`dt-tile small tone-${a.tone}`}>
                  <a.icon size={16} aria-hidden />
                </span>
              </button>
            );
          })}
        </div>
        <div className="dt-tray">
          {d.online ? <Wifi size={15} aria-label="Connected" /> : <WifiOff size={15} aria-label="No network" />}
          <Volume2 size={15} aria-hidden />
          <Battery size={15} aria-hidden />
          <Clock />
        </div>
      </div>
    </div>
  );
}
