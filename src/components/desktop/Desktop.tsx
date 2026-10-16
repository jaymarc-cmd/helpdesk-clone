import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Columns2,
  FileText,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  MonitorSmartphone,
  Palette,
  Pin,
  PinOff,
  Plug,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  SquareTerminal,
  Unplug,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { actionLabel } from '../../data/actions';
import type { Work } from '../../state/store';
import { APPS, APP_BY_ID, type AppId, type AppProps } from './registry';
import { BrowserApp, ExplorerApp, MailApp, PrintersApp, SETTINGS_SECTIONS, SecurityApp, SettingsApp, TrashApp, UpdatesApp, VpnApp } from './apps';
import { NotepadApp, TaskManagerApp } from './tools';
import { CalendarFlyout, ContextMenu, PowerScreen, QuickSettings, WinDialog, usePrefs, type MenuEntry, type Note, type PowerState } from './shell';
import { TerminalPane } from '../work';
import '../../styles/desktop.css';

type Snap = 'left' | 'right' | null;

interface Win {
  app: AppId;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  snap: Snap;
  arg?: string;
  argSeq: number;
}

const MIN_W = 320;
const MIN_H = 200;
const DEFAULT_PINNED: AppId[] = ['explorer', 'browser', 'mail', 'terminal', 'settings'];
const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join('');

/**
 * A simulated remote desktop on the ticket's device. Each app maps its buttons to ticket actions,
 * so fixing things here is graded exactly like any other tool.
 */
export function Desktop({ work, onDisconnect }: { work: Work; onDisconnect: () => void }) {
  const d = work.session.device;
  const userName = work.scenario.accountOwner?.name ?? work.scenario.requester.name;
  const frameRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [prefs, setPref] = usePrefs();
  const [wins, setWins] = useState<Win[]>([]);
  const [fly, setFly] = useState<'start' | 'calendar' | 'quick' | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [toast, setToast] = useState<{ title: string; text: string; key: number } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [full, setFull] = useState(false);
  const [power, setPower] = useState<PowerState>('welcome');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [pinned, setPinned] = useState<AppId[]>(DEFAULT_PINNED);
  const [recent, setRecent] = useState<AppId[]>([]);
  const [selIcons, setSelIcons] = useState<AppId[]>([]);
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [preview, setPreview] = useState<Snap | 'max'>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [powerMenu, setPowerMenu] = useState(false);
  const hiddenByShowDesktop = useRef<AppId[]>([]);
  const iconRefs = useRef<Partial<Record<AppId, HTMLButtonElement | null>>>({});
  const pointerKind = useRef('mouse');
  const zTop = useRef(10);
  const lastCount = useRef(work.session.actionResults.length);
  const now = useClock();

  // Sign-in and restart screens time out on their own.
  useEffect(() => {
    if (power === 'welcome') {
      const t = setTimeout(() => setPower('ready'), 1300);
      return () => clearTimeout(t);
    }
    if (power === 'restarting') {
      const t = setTimeout(() => setPower('welcome'), 2600);
      return () => clearTimeout(t);
    }
  }, [power]);

  // Notify for every new action result; a restart takes the session through the restart screen.
  useEffect(() => {
    const rs = work.session.actionResults;
    if (rs.length > lastCount.current) {
      const r = rs[rs.length - 1];
      // Guided-step actions are worded for the user; done remotely they are just a settings change.
      const title = r.id.startsWith('guide_') ? 'Change applied' : actionLabel(r.id);
      setNotes((n) => [...n, { title, text: r.text, at: Date.now() }].slice(-20));
      setUnread((u) => u + 1);
      if (!prefs.focus) setToast({ title, text: r.text, key: Date.now() });
      if (r.id === 'remote_restart' || r.id === 'reimage') {
        setWins([]);
        setFly(null);
        setPower('restarting');
      }
    }
    lastCount.current = rs.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.session.actionResults]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- windows ----------

  const closeMenus = () => {
    setFly(null);
    setMenu(null);
    setPowerMenu(false);
  };

  const focus = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false } : w)));

  const open = (app: AppId, arg?: string) => {
    closeMenus();
    setQ('');
    setRecent((r) => [app, ...r.filter((x) => x !== app)].slice(0, 4));
    setWins((ws) => {
      if (ws.some((w) => w.app === app))
        return ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false, ...(arg !== undefined ? { arg, argSeq: w.argSeq + 1 } : {}) } : w));
      const area = areaRef.current?.getBoundingClientRect();
      const def = APP_BY_ID[app];
      const aw = area?.width ?? 900;
      const ah = area?.height ?? 560;
      const w = Math.min(def.width, aw - 16);
      const h = Math.min(def.height, ah - 16);
      const n = ws.length;
      return [
        ...ws,
        {
          app,
          w,
          h,
          x: Math.max(8, Math.min(aw - w - 8, 140 + n * 28)),
          y: Math.max(8, Math.min(ah - h - 8, 20 + n * 26)),
          z: ++zTop.current,
          minimized: false,
          maximized: false,
          snap: null,
          arg,
          argSeq: 0,
        },
      ];
    });
  };
  const close = (app: AppId) => setWins((ws) => ws.filter((w) => w.app !== app));
  const patch = (app: AppId, p: Partial<Win>) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, ...p } : w)));
  const toggleMin = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, minimized: !w.minimized } : w)));
  const toggleMax = (app: AppId) => setWins((ws) => ws.map((w) => (w.app === app ? { ...w, maximized: !w.maximized, snap: null, z: ++zTop.current } : w)));

  const showDesktop = () => {
    const visible = wins.filter((w) => !w.minimized).map((w) => w.app);
    if (visible.length) {
      hiddenByShowDesktop.current = visible;
      setWins((ws) => ws.map((w) => ({ ...w, minimized: true })));
    } else {
      const back = hiddenByShowDesktop.current;
      setWins((ws) => ws.map((w) => (back.includes(w.app) ? { ...w, minimized: false } : w)));
      hiddenByShowDesktop.current = [];
    }
  };

  /** Drag by the title bar. Dragging a maximised or snapped window restores it; screen edges snap. */
  const startDrag = (app: AppId, e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const w = wins.find((x) => x.app === app);
    const area = areaRef.current?.getBoundingClientRect();
    const winEl = (e.currentTarget as HTMLElement).closest('.dt-win') as HTMLElement | null;
    if (!w || !area || !winEl) return;
    focus(app);
    const rect = winEl.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    let docked = w.maximized || !!w.snap;
    let ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    let target: Snap | 'max' = null;

    const move = (ev: PointerEvent) => {
      if (docked) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        docked = false;
        // Keep the grab point at the same place along the title bar as the window shrinks back.
        ox = Math.min(w.w - 60, (ox / rect.width) * w.w);
        patch(app, { maximized: false, snap: null });
      }
      const px = ev.clientX - area.left;
      const py = ev.clientY - area.top;
      const x = Math.min(Math.max(-w.w + 120, px - ox), area.width - 120);
      const y = Math.min(Math.max(0, py - oy), area.height - 40);
      target = px < 8 ? 'left' : px > area.width - 8 ? 'right' : py < 6 ? 'max' : null;
      setPreview(target);
      setWins((ws) => ws.map((v) => (v.app === app ? { ...v, x, y } : v)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPreview(null);
      if (target === 'max') patch(app, { maximized: true });
      else if (target) patch(app, { snap: target });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (app: AppId, dir: (typeof RESIZE_DIRS)[number], e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const w = wins.find((x) => x.app === app);
    const area = areaRef.current?.getBoundingClientRect();
    if (!w || !area || w.maximized) return;
    focus(app);
    const base = w.snap ? { x: w.snap === 'left' ? 0 : area.width / 2, y: 0, w: area.width / 2, h: area.height } : { x: w.x, y: w.y, w: w.w, h: w.h };
    if (w.snap) patch(app, { ...base, snap: null });
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, w: W, h: H } = base;
      if (dir.includes('e')) W = Math.min(area.width - x, Math.max(MIN_W, base.w + dx));
      if (dir.includes('w')) {
        W = Math.max(MIN_W, Math.min(base.x + base.w, base.w - dx));
        x = base.x + base.w - W;
      }
      if (dir.includes('s')) H = Math.min(area.height - y, Math.max(MIN_H, base.h + dy));
      if (dir.includes('n')) {
        H = Math.max(MIN_H, Math.min(base.y + base.h, base.h - dy));
        y = base.y + base.h - H;
      }
      setWins((ws) => ws.map((v) => (v.app === app ? { ...v, x, y, w: W, h: H } : v)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- desktop icons and rubber-band selection ----------

  const icons = useMemo(() => {
    const list = APPS.filter((a) => a.desktop);
    return prefs.sortByName ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list;
  }, [prefs.sortByName]);

  const onScreenPointerDown = (e: ReactPointerEvent) => {
    closeMenus();
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.dt-win, .dt-icon, .dt-toast, .dt-dialog-back, .dt-power')) return;
    const area = areaRef.current?.getBoundingClientRect();
    if (!area) return;
    const x0 = e.clientX - area.left;
    const y0 = e.clientY - area.top;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const x1 = ev.clientX - area.left;
      const y1 = ev.clientY - area.top;
      if (!moved && Math.hypot(x1 - x0, y1 - y0) < 5) return;
      moved = true;
      setBand({ x0, y0, x1, y1 });
      const L = Math.min(x0, x1) + area.left;
      const R = Math.max(x0, x1) + area.left;
      const T = Math.min(y0, y1) + area.top;
      const B = Math.max(y0, y1) + area.top;
      setSelIcons(
        icons
          .filter((a) => {
            const r = iconRefs.current[a.id]?.getBoundingClientRect();
            return r && r.right > L && r.left < R && r.bottom > T && r.top < B;
          })
          .map((a) => a.id),
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setBand(null);
      if (!moved) setSelIcons([]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- context menus ----------

  const showMenu = (e: ReactMouseEvent, items: MenuEntry[]) => {
    e.preventDefault();
    e.stopPropagation();
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return;
    setFly(null);
    setPowerMenu(false);
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, items });
  };
  const pinItem = (app: AppId): MenuEntry =>
    pinned.includes(app)
      ? { label: 'Unpin from taskbar', icon: PinOff, onSelect: () => setPinned((p) => p.filter((x) => x !== app)) }
      : { label: 'Pin to taskbar', icon: Pin, onSelect: () => setPinned((p) => [...p, app]) };

  const desktopMenu: MenuEntry[] = [
    { label: 'Large icons', checked: prefs.iconSize === 'large', onSelect: () => setPref('iconSize', 'large') },
    { label: 'Medium icons', checked: prefs.iconSize === 'medium', onSelect: () => setPref('iconSize', 'medium') },
    { label: 'Small icons', checked: prefs.iconSize === 'small', onSelect: () => setPref('iconSize', 'small') },
    { label: 'Show desktop icons', checked: prefs.showIcons, onSelect: () => setPref('showIcons', !prefs.showIcons) },
    'sep',
    { label: 'Sort by name', checked: prefs.sortByName, onSelect: () => setPref('sortByName', !prefs.sortByName) },
    {
      label: 'Refresh',
      icon: RefreshCw,
      onSelect: () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 180);
      },
    },
    'sep',
    { label: 'New text document', icon: FileText, onSelect: () => open('notepad', '') },
    { label: 'Open in Terminal', icon: SquareTerminal, onSelect: () => open('terminal') },
    { label: 'Task Manager', icon: Activity, onSelect: () => open('taskmgr') },
    'sep',
    { label: 'Display settings', icon: Monitor, onSelect: () => open('settings', 'display') },
    { label: 'Personalise', icon: Palette, onSelect: () => open('settings', 'personalize') },
  ];

  const windowMenu = (w: Win): MenuEntry[] => [
    { label: 'Restore', icon: Minimize2, disabled: !w.maximized && !w.snap, onSelect: () => patch(w.app, { maximized: false, snap: null }) },
    { label: 'Minimise', icon: Minus, onSelect: () => toggleMin(w.app) },
    { label: 'Maximise', icon: Maximize2, disabled: w.maximized, onSelect: () => toggleMax(w.app) },
    'sep',
    { label: 'Snap left', icon: Columns2, onSelect: () => patch(w.app, { snap: 'left', maximized: false }) },
    { label: 'Snap right', icon: Columns2, onSelect: () => patch(w.app, { snap: 'right', maximized: false }) },
    'sep',
    { label: 'Close', icon: X, hint: 'Alt+F4', onSelect: () => close(w.app) },
  ];

  const taskbarMenu: MenuEntry[] = [
    { label: 'Task Manager', icon: Activity, onSelect: () => open('taskmgr') },
    { label: 'Show desktop', icon: Monitor, onSelect: showDesktop },
  ];

  // ---------- app props ----------

  const resultFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of work.session.actionResults) m.set(r.id, r.text);
    return m;
  }, [work.session.actionResults]);

  const running = wins.map((w) => w.app);
  const propsFor = (w: Win): AppProps => ({
    work,
    run: (id) => work.emit({ type: 'action', actionId: id }),
    result: (id) => resultFor.get(id),
    done: (id) => work.session.actions.includes(id),
    open,
    closeApp: close,
    running,
    arg: w.arg,
    argSeq: w.argSeq,
    prefs,
    setPref,
  });

  const content = (w: Win): ReactNode => {
    const props = propsFor(w);
    switch (w.app) {
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
      case 'taskmgr':
        return <TaskManagerApp {...props} />;
      case 'notepad':
        // A new file replaces the open one.
        return <NotepadApp key={w.argSeq} {...props} />;
    }
  };

  const topApp = [...wins].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.app;

  // ---------- Start menu search ----------

  const query = q.trim().toLowerCase();
  const appHits = query ? APPS.filter((a) => `${a.title} ${a.keywords ?? ''}`.toLowerCase().includes(query)) : [];
  const settingHits = query ? SETTINGS_SECTIONS.filter((s) => `${s.label} ${s.keywords}`.toLowerCase().includes(query)) : [];
  const firstHit = () => {
    if (appHits[0]) open(appHits[0].id);
    else if (settingHits[0]) open('settings', settingHits[0].id);
  };
  const toggleFly = (f: 'start' | 'calendar' | 'quick') => {
    setMenu(null);
    setPowerMenu(false);
    if (f === 'calendar') setUnread(0);
    setToast(null);
    setFly((cur) => (cur === f ? null : f));
  };

  const VolIcon = prefs.muted || prefs.volume === 0 ? VolumeX : prefs.volume < 50 ? Volume1 : Volume2;
  const isDesktopPc = /Desktop/i.test(d.model);
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      ref={frameRef}
      className={`dt-frame ${full ? 'full' : ''}`}
      style={{ '--dt-accent': prefs.accent } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeMenus();
        if (e.altKey && e.key === 'F4' && topApp) {
          e.preventDefault();
          close(topApp);
        }
      }}
    >
      <div className="dt-titlebar">
        <span className="dt-title">
          <MonitorSmartphone size={14} aria-hidden />
          <span className="mono">{d.hostname}</span>
          <span className="dt-title-sep">·</span>
          {userName}
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

      <div
        className="dt-screen"
        ref={areaRef}
        style={{ filter: prefs.brightness < 100 ? `brightness(${prefs.brightness / 100})` : undefined }}
        onPointerDown={onScreenPointerDown}
        onContextMenu={(e) => {
          // Inside app windows, keep the browser's own menu (copy, paste).
          if ((e.target as HTMLElement).closest('.dt-win, .dt-flyout, .dt-start, .dt-power')) return;
          showMenu(e, desktopMenu);
        }}
      >
        <div className={`dt-wallpaper wp-${prefs.wallpaper}`} aria-hidden />

        {prefs.showIcons && (
          <div className={`dt-icons size-${prefs.iconSize} ${refreshing ? 'refreshing' : ''}`} role="list" aria-label="Desktop">
            {icons.map((a) => (
              <button
                key={a.id}
                ref={(el) => {
                  iconRefs.current[a.id] = el;
                }}
                className={`dt-icon ${selIcons.includes(a.id) ? 'sel' : ''}`}
                role="listitem"
                onPointerDown={(e) => {
                  pointerKind.current = e.pointerType;
                  closeMenus();
                }}
                onClick={(e) => {
                  // Keyboard and touch open straight away; a mouse click selects and a double-click opens.
                  if (e.detail === 0 || pointerKind.current === 'touch') return open(a.id);
                  setSelIcons((s) => (e.ctrlKey || e.metaKey ? (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]) : [a.id]));
                }}
                onDoubleClick={() => open(a.id)}
                onContextMenu={(e) => {
                  setSelIcons([a.id]);
                  showMenu(e, [{ label: 'Open', icon: a.icon, onSelect: () => open(a.id) }, pinItem(a.id)]);
                }}
                title={a.title}
              >
                <span className={`dt-tile tone-${a.tone}`}>
                  <a.icon strokeWidth={1.8} aria-hidden />
                </span>
                <span className="dt-icon-label">{a.title}</span>
              </button>
            ))}
          </div>
        )}

        {band && (
          <div
            className="dt-band"
            style={{ left: Math.min(band.x0, band.x1), top: Math.min(band.y0, band.y1), width: Math.abs(band.x1 - band.x0), height: Math.abs(band.y1 - band.y0) }}
            aria-hidden
          />
        )}
        {preview && <div className={`dt-snap-preview ${preview}`} aria-hidden />}

        {wins.map((w) => {
          const def = APP_BY_ID[w.app];
          const docked = w.maximized || w.snap;
          return (
            <section
              key={w.app}
              className={`dt-win ${w.maximized ? 'max' : ''} ${w.snap ? `snap-${w.snap}` : ''} ${topApp === w.app ? 'active' : ''}`}
              style={{
                ...(docked ? {} : { left: w.x, top: w.y, width: w.w, height: w.h }),
                zIndex: w.z,
                display: w.minimized ? 'none' : undefined,
              }}
              onPointerDown={() => {
                if (topApp !== w.app) focus(w.app);
              }}
              aria-label={def.title}
            >
              <header className="dt-win-bar" onPointerDown={(e) => startDrag(w.app, e)} onDoubleClick={() => toggleMax(w.app)} onContextMenu={(e) => showMenu(e, windowMenu(w))}>
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
              <div className="dt-win-body">{content(w)}</div>
              {!w.maximized && RESIZE_DIRS.map((dir) => <span key={dir} className={`dt-rs ${dir}`} onPointerDown={(e) => startResize(w.app, dir, e)} aria-hidden />)}
            </section>
          );
        })}

        {fly === 'start' && (
          <div className="dt-start" onPointerDown={(e) => e.stopPropagation()}>
            <label className="dt-start-search">
              <Search size={14} aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') firstHit();
                }}
                placeholder="Search for apps and settings"
                aria-label="Search"
              />
            </label>
            {query ? (
              <div className="dt-start-results">
                {appHits.length + settingHits.length === 0 && <p className="dt-row-sub">No results for "{q}"</p>}
                {appHits.map((a, i) => (
                  <button key={a.id} className={i === 0 ? 'best' : ''} onClick={() => open(a.id)}>
                    <span className={`dt-tile small tone-${a.tone}`}>
                      <a.icon size={16} aria-hidden />
                    </span>
                    <span>
                      <strong>{a.title}</strong>
                      <span className="dt-row-sub">App</span>
                    </span>
                  </button>
                ))}
                {settingHits.map((s, i) => (
                  <button key={s.id} className={appHits.length === 0 && i === 0 ? 'best' : ''} onClick={() => open('settings', s.id)}>
                    <span className="dt-tile small tone-graphite">
                      <s.icon size={16} aria-hidden />
                    </span>
                    <span>
                      <strong>{s.label}</strong>
                      <span className="dt-row-sub">Settings</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="dt-start-label">All apps</div>
                <div className="dt-start-grid">
                  {APPS.map((a) => (
                    <button key={a.id} onClick={() => open(a.id)} onContextMenu={(e) => showMenu(e, [{ label: 'Open', icon: a.icon, onSelect: () => open(a.id) }, pinItem(a.id)])}>
                      <span className={`dt-tile small tone-${a.tone}`}>
                        <a.icon size={18} aria-hidden />
                      </span>
                      <span>{a.title}</span>
                    </button>
                  ))}
                </div>
                <div className="dt-start-label">Recent</div>
                {recent.length === 0 ? (
                  <p className="dt-row-sub">Apps you open appear here.</p>
                ) : (
                  <div className="dt-start-recent">
                    {recent.map((id) => {
                      const a = APP_BY_ID[id];
                      return (
                        <button key={id} onClick={() => open(id)}>
                          <a.icon size={14} aria-hidden /> {a.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <div className="dt-start-foot">
              <span className="dt-start-user">
                <span className="dt-avatar small">{initialsOf(userName)}</span>
                <span>
                  {userName}
                  <span className="dt-row-sub mono"> · {work.session.account.username}</span>
                </span>
              </span>
              <span className="dt-power-wrap">
                <button className="dt-icon-btn" onClick={() => setPowerMenu((m) => !m)} aria-label="Power" aria-expanded={powerMenu}>
                  <Power size={16} />
                </button>
                {powerMenu && (
                  <span className="dt-power-menu" role="menu">
                    <button
                      role="menuitem"
                      onClick={() => {
                        closeMenus();
                        setPower('locked');
                      }}
                    >
                      <Lock size={14} aria-hidden /> Lock
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        closeMenus();
                        setConfirmRestart(true);
                      }}
                    >
                      <RotateCcw size={14} aria-hidden /> Restart
                    </button>
                    <button role="menuitem" onClick={onDisconnect}>
                      <Unplug size={14} aria-hidden /> Disconnect
                    </button>
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {fly === 'calendar' && (
          <CalendarFlyout
            notes={notes}
            onClear={() => {
              setNotes([]);
              setUnread(0);
            }}
          />
        )}
        {fly === 'quick' && <QuickSettings prefs={prefs} setPref={setPref} device={d} onOpenSettings={(s) => open('settings', s)} />}

        {toast && (
          <div
            className="dt-toast"
            key={toast.key}
            role="status"
            onClick={() => {
              setToast(null);
              toggleFly('calendar');
            }}
          >
            <strong>{toast.title}</strong>
            <span>{toast.text}</span>
          </div>
        )}

        {confirmRestart && (
          <WinDialog
            icon={RotateCcw}
            tone="warn"
            title={`Restart ${d.hostname}?`}
            onClose={() => setConfirmRestart(false)}
            actions={
              <>
                <button className="dt-btn" onClick={() => setConfirmRestart(false)}>
                  Cancel
                </button>
                <button
                  className="dt-btn danger-fill"
                  onClick={() => {
                    setConfirmRestart(false);
                    work.emit({ type: 'action', actionId: 'remote_restart' });
                  }}
                >
                  Restart
                </button>
              </>
            }
          >
            {userName} loses any unsaved work. The restart is recorded on the ticket.
          </WinDialog>
        )}

        {prefs.nightLight && <div className="dt-night" aria-hidden />}
        {power !== 'ready' && <PowerScreen state={power} name={userName} onUnlock={() => setPower('welcome')} />}
      </div>

      <div className="dt-taskbar" onContextMenu={(e) => showMenu(e, taskbarMenu)}>
        <div className="dt-task-left">
          <button className="dt-task-search" onClick={() => toggleFly('start')}>
            <Search size={14} aria-hidden />
            <span>Search</span>
          </button>
        </div>
        <div className="dt-task-center">
          <button className={`dt-task start ${fly === 'start' ? 'on' : ''}`} onClick={() => toggleFly('start')} aria-label="Start" aria-expanded={fly === 'start'}>
            <span className="dt-start-logo" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>
          {[...new Set([...pinned, ...running])].map((id) => {
            const a = APP_BY_ID[id];
            const w = wins.find((x) => x.app === id);
            return (
              <button
                key={id}
                className={`dt-task ${w ? 'running' : ''} ${topApp === id ? 'on' : ''}`}
                onClick={() => (w && topApp === id ? toggleMin(id) : open(id))}
                onContextMenu={(e) =>
                  showMenu(e, [
                    { label: a.title, icon: a.icon, onSelect: () => open(id) },
                    pinItem(id),
                    ...(w ? (['sep', { label: 'Close window', icon: X, onSelect: () => close(id) }] as MenuEntry[]) : []),
                  ])
                }
                aria-label={a.title}
                title={w ? `${a.title}${w.minimized ? ' (minimised)' : ''}` : a.title}
              >
                <span className={`dt-tile small tone-${a.tone}`}>
                  <a.icon size={16} aria-hidden />
                </span>
              </button>
            );
          })}
        </div>
        <div className="dt-tray">
          <button className={`dt-tray-btn ${fly === 'quick' ? 'on' : ''}`} onClick={() => toggleFly('quick')} aria-label="Quick settings" aria-expanded={fly === 'quick'}>
            {d.online ? <Wifi size={15} aria-hidden /> : <WifiOff size={15} aria-hidden />}
            <VolIcon size={15} aria-hidden />
            {isDesktopPc ? <Plug size={15} aria-hidden /> : d.online ? <BatteryCharging size={15} aria-hidden /> : <Battery size={15} aria-hidden />}
          </button>
          <button
            className={`dt-tray-btn dt-clock ${fly === 'calendar' ? 'on' : ''}`}
            onClick={() => toggleFly('calendar')}
            aria-label={`${time}. Notifications and calendar`}
            aria-expanded={fly === 'calendar'}
          >
            <span>{time}</span>
            <span>{now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {unread > 0 && <span className="dt-badge num">{unread}</span>}
          </button>
          <button className="dt-show-desktop" onClick={showDesktop} aria-label="Show desktop" title="Show desktop" />
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
