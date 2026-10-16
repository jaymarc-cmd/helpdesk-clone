import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  Bell,
  BellOff,
  Bluetooth,
  Check,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plane,
  Sun,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { DeviceState } from '../../types';

// ---------------- Preferences (per browser, like a roaming profile) ----------------

export type Wallpaper = 'harbour' | 'dawn' | 'forest' | 'night';
export const WALLPAPERS: { id: Wallpaper; label: string }[] = [
  { id: 'harbour', label: 'Harbour dusk' },
  { id: 'dawn', label: 'Pine dawn' },
  { id: 'forest', label: 'Deep forest' },
  { id: 'night', label: 'Night shift' },
];
export const ACCENTS = ['#0b7a6e', '#2272c9', '#6a4cc2', '#c8412e', '#b7791f'];

export interface DesktopPrefs {
  wallpaper: Wallpaper;
  accent: string;
  iconSize: 'small' | 'medium' | 'large';
  showIcons: boolean;
  sortByName: boolean;
  brightness: number;
  nightLight: boolean;
  volume: number;
  muted: boolean;
  focus: boolean;
  bluetooth: boolean;
}

const DEFAULT_PREFS: DesktopPrefs = {
  wallpaper: 'harbour',
  accent: ACCENTS[0],
  iconSize: 'medium',
  showIcons: true,
  sortByName: false,
  brightness: 100,
  nightLight: false,
  volume: 60,
  muted: false,
  focus: false,
  bluetooth: true,
};
const PREFS_KEY = 'tierone-desktop-prefs';

export type SetPref = <K extends keyof DesktopPrefs>(key: K, value: DesktopPrefs[K]) => void;

export function usePrefs(): [DesktopPrefs, SetPref] {
  const [prefs, setPrefs] = useState<DesktopPrefs>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DesktopPrefs>) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const set: SetPref = (key, value) =>
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: the preference lasts for this session only.
      }
      return next;
    });
  return [prefs, set];
}

// ---------------- Small controls ----------------

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`dt-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

/** A live line graph, newest sample on the right. */
export function Graph({ data, max = 100, tone = 'var(--dt-accent)' }: { data: number[]; max?: number; tone?: string }) {
  const n = Math.max(2, data.length);
  const pts = data.map((v, i) => `${(i / (n - 1)) * 100},${40 - (Math.min(max, v) / max) * 38}`).join(' ');
  return (
    <svg className="dt-graph" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
      {[10, 20, 30].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} />
      ))}
      {data.length > 1 && (
        <>
          <polygon points={`0,40 ${pts} 100,40`} style={{ fill: tone }} />
          <polyline points={pts} style={{ stroke: tone }} />
        </>
      )}
    </svg>
  );
}

// ---------------- Context menu ----------------

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  checked?: boolean;
  disabled?: boolean;
  hint?: string;
}
export type MenuEntry = MenuItem | 'sep';

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Keep the menu inside the screen.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    setPos({
      x: Math.max(4, Math.min(x, parent.clientWidth - el.offsetWidth - 4)),
      y: Math.max(4, Math.min(y, parent.clientHeight - el.offsetHeight - 4)),
    });
  }, [x, y]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const h = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus();
  };

  return (
    <div
      ref={ref}
      className="dt-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKey}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="dt-menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect?.();
            }}
          >
            <span className="dt-menu-icon">{it.checked ? <Check size={14} /> : it.icon ? <it.icon size={14} /> : null}</span>
            <span className="dt-menu-label">{it.label}</span>
            {it.hint && <span className="dt-menu-hint">{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}

// ---------------- In-window dialog ----------------

/** A dialog that belongs to one window, like a native message box. */
export function WinDialog({
  icon: Icon,
  tone = 'info',
  title,
  children,
  actions,
  onClose,
}: {
  icon: LucideIcon;
  tone?: 'info' | 'warn' | 'bad';
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.dt-dialog-actions button')?.focus();
  }, []);
  return (
    <div
      className="dt-dialog-back"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div ref={ref} className="dt-dialog" role="alertdialog" aria-label={title}>
        <div className="dt-dialog-body">
          <Icon size={28} className={`dt-dialog-icon ${tone}`} aria-hidden />
          <div>
            <div className="dt-dialog-title">{title}</div>
            {children && <div className="dt-dialog-text">{children}</div>}
          </div>
        </div>
        <div className="dt-dialog-actions">{actions}</div>
      </div>
    </div>
  );
}

// ---------------- Tray flyouts ----------------

export interface Note {
  title: string;
  text: string;
  at: number;
}

export function CalendarFlyout({ notes, onClear }: { notes: Note[]; onClear: () => void }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isThisMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="dt-flyout dt-cal-fly" onPointerDown={(e) => e.stopPropagation()}>
      <section className="dt-fly-card">
        <div className="dt-fly-head">
          <strong>Notifications</strong>
          {notes.length > 0 && (
            <button className="dt-link" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="dt-row-sub dt-fly-empty">No new notifications</p>
        ) : (
          <ul className="dt-notes">
            {[...notes].reverse().map((n) => (
              <li key={n.at}>
                <strong>{n.title}</strong>
                <span>{n.text}</span>
                <time className="dt-row-sub">{new Date(n.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="dt-fly-card">
        <div className="dt-fly-head">
          <strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
          <span className="dt-cal-nav">
            <button onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight size={14} />
            </button>
          </span>
        </div>
        <div className="dt-cal">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="dt-cal-dow">
              {d}
            </span>
          ))}
          {cells.map((d, i) => (
            <span key={i} className={`dt-cal-day ${isThisMonth && d === today.getDate() ? 'today' : ''}`}>
              {d ?? ''}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export function QuickSettings({
  prefs,
  setPref,
  device,
  onOpenSettings,
}: {
  prefs: DesktopPrefs;
  setPref: SetPref;
  device: DeviceState;
  onOpenSettings: (section: string) => void;
}) {
  const [warn, setWarn] = useState('');
  const office = device.ip.startsWith('10.');
  const VolIcon = prefs.muted || prefs.volume === 0 ? VolumeX : prefs.volume < 50 ? Volume1 : Volume2;
  const tiles: { label: string; sub: string; icon: LucideIcon; on: boolean; click: () => void }[] = [
    {
      label: device.online ? (office ? 'HPL-Corp' : 'Wi-Fi') : 'No network',
      sub: device.online ? 'Connected' : 'Not connected',
      icon: device.online ? Wifi : WifiOff,
      on: device.online,
      click: () => setWarn('Turning off the network would end this remote session.'),
    },
    {
      label: 'Bluetooth',
      sub: prefs.bluetooth ? 'On' : 'Off',
      icon: Bluetooth,
      on: prefs.bluetooth,
      click: () => setPref('bluetooth', !prefs.bluetooth),
    },
    {
      label: 'Airplane mode',
      sub: 'Off',
      icon: Plane,
      on: false,
      click: () => setWarn('Airplane mode would drop the network and end this remote session.'),
    },
    {
      label: 'Do not disturb',
      sub: prefs.focus ? 'On' : 'Off',
      icon: prefs.focus ? BellOff : Bell,
      on: prefs.focus,
      click: () => setPref('focus', !prefs.focus),
    },
    {
      label: 'Night light',
      sub: prefs.nightLight ? 'On' : 'Off',
      icon: Moon,
      on: prefs.nightLight,
      click: () => setPref('nightLight', !prefs.nightLight),
    },
  ];
  return (
    <div className="dt-flyout dt-qs" onPointerDown={(e) => e.stopPropagation()}>
      <section className="dt-fly-card">
        <div className="dt-qs-tiles">
          {tiles.map((t) => (
            <button key={t.label} className={`dt-qs-tile ${t.on ? 'on' : ''}`} onClick={t.click} aria-pressed={t.on}>
              <t.icon size={16} aria-hidden />
              <span className="dt-qs-label">{t.label}</span>
              <span className="dt-qs-sub">{t.sub}</span>
            </button>
          ))}
        </div>
        {warn && (
          <p className="dt-qs-warn" role="status">
            {warn}
          </p>
        )}
        <label className="dt-slider">
          <Sun size={16} aria-hidden />
          <input type="range" min={30} max={100} value={prefs.brightness} onChange={(e) => setPref('brightness', Number(e.target.value))} aria-label="Brightness" />
        </label>
        <label className="dt-slider">
          <button className="dt-icon-btn" onClick={() => setPref('muted', !prefs.muted)} aria-label={prefs.muted ? 'Unmute' : 'Mute'}>
            <VolIcon size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={prefs.muted ? 0 : prefs.volume}
            onChange={(e) => {
              setPref('volume', Number(e.target.value));
              if (prefs.muted) setPref('muted', false);
            }}
            aria-label="Volume"
          />
          <span className="dt-slider-val num">{prefs.muted ? 0 : prefs.volume}</span>
        </label>
      </section>
      <div className="dt-qs-foot">
        <span>{/Desktop/i.test(device.model) ? 'Plugged in' : '76% · Plugged in'}</span>
        <button className="dt-link" onClick={() => onOpenSettings('network')}>
          Network settings
        </button>
      </div>
    </div>
  );
}

// ---------------- Sign-in, lock and restart screens ----------------

export type PowerState = 'welcome' | 'ready' | 'locked' | 'restarting';

export function PowerScreen({ state, name, onUnlock }: { state: Exclude<PowerState, 'ready'>; name: string; onUnlock: () => void }) {
  const now = new Date();
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (state === 'restarting')
    return (
      <div className="dt-power dark" role="status">
        <span className="dt-spinner" aria-hidden />
        <span>Restarting</span>
      </div>
    );
  if (state === 'locked')
    return (
      <button className="dt-power lock" onClick={onUnlock} onKeyDown={onUnlock} autoFocus aria-label="Locked. Click to sign in">
        <span className="dt-lock-time">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        <span className="dt-lock-date">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <span className="dt-lock-hint">Click or press a key to sign in</span>
      </button>
    );
  return (
    <div className="dt-power" role="status">
      <span className="dt-avatar">{initials}</span>
      <strong>{name}</strong>
      <span className="dt-welcome">
        <span className="dt-spinner" aria-hidden />
        Welcome
      </span>
    </div>
  );
}
