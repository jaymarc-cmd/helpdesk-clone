import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Keyboard, Laptop, type LucideIcon, Search, Shuffle, SunMoon, Ticket, Timer, UserRound } from 'lucide-react';
import { directoryPeople } from '../data/directory';
import { KB_ARTICLES } from '../data/kb';
import { useStore } from '../state/store';
import { NAV_LINKS } from './shell';
import { ticketNumber, useDialogFocus } from './ui';

interface Entry {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: LucideIcon;
  /** Lower-case text the query is matched against. */
  hay: string;
  to?: string;
  run?: () => void;
}

const GROUPS = ['Your tickets', 'Actions', 'Pages', 'Tickets', 'People', 'Devices', 'Knowledge base'];
const PER_GROUP = 6;

export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

/** Every word must appear somewhere; hits at the start of the label rank first. */
function score(e: Entry, words: string[]): number {
  const label = e.label.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (!e.hay.includes(w)) return -1;
    s += label.startsWith(w) ? 3 : label.includes(w) ? 2 : 1;
  }
  return s;
}

const hay = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ').toLowerCase();

/** Search-and-jump across the whole workstation: pages, tickets, people, devices and articles. */
export function CommandPalette({ onClose, onShortcuts }: { onClose: () => void; onShortcuts: () => void }) {
  const { state, dispatch, scenarios, works } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);

  const entries = useMemo<Entry[]>(() => {
    const dark =
      state.settings.theme === 'dark' || (state.settings.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    const open = new Set(works.map((w) => w.scenario.id));
    const out: Entry[] = [];
    for (const w of works) {
      const sc = w.scenario;
      out.push({
        id: `w-${sc.id}`,
        group: 'Your tickets',
        label: sc.title,
        sub: `${ticketNumber(sc.id)} · ${w.hold ? `On hold: ${w.hold.reason}` : 'In progress'}`,
        icon: Ticket,
        hay: hay(sc.title, ticketNumber(sc.id), sc.requester.name, 'open mine'),
        to: `/ticket/${sc.id}`,
      });
    }
    const fresh = scenarios.filter((s) => !open.has(s.id));
    out.push(
      {
        id: 'a-random',
        group: 'Actions',
        label: 'Pick up a random ticket',
        icon: Shuffle,
        hay: 'random ticket pick new start',
        run: () => fresh.length && navigate(`/ticket/${fresh[Math.floor(Math.random() * fresh.length)].id}`),
      },
      { id: 'a-shift', group: 'Actions', label: 'Start a shift', icon: Timer, hay: 'start shift clock in timed sla', to: '/shift' },
      {
        id: 'a-theme',
        group: 'Actions',
        label: dark ? 'Switch to light theme' : 'Switch to dark theme',
        icon: SunMoon,
        hay: 'theme dark light mode appearance',
        run: () => dispatch({ type: 'settings', patch: { theme: dark ? 'light' : 'dark' } }),
      },
      { id: 'a-keys', group: 'Actions', label: 'Keyboard shortcuts', icon: Keyboard, hay: 'keyboard shortcuts keys help', run: onShortcuts },
    );
    for (const n of NAV_LINKS) out.push({ id: `p-${n.to}`, group: 'Pages', label: n.label, icon: n.icon, hay: hay(n.label, n.keywords), to: n.to });
    for (const sc of scenarios) {
      if (open.has(sc.id)) continue;
      out.push({
        id: `t-${sc.id}`,
        group: 'Tickets',
        label: sc.title,
        sub: `${ticketNumber(sc.id)} · ${sc.requester.name} · ${sc.category}`,
        icon: Ticket,
        hay: hay(sc.title, ticketNumber(sc.id), sc.requester.name, sc.requester.department, sc.category),
        to: `/ticket/${sc.id}`,
      });
    }
    const people = directoryPeople(scenarios);
    for (const p of people) {
      out.push({
        id: `u-${p.username}`,
        group: 'People',
        label: p.name,
        sub: `${p.username} · ${p.title}, ${p.department}`,
        icon: UserRound,
        hay: hay(p.name, p.username, p.title, p.department, p.email),
        to: `/directory/${p.username}`,
      });
    }
    const owners = new Map(people.map((p) => [p.username, p.name]));
    const seen = new Set<string>();
    for (const sc of scenarios) {
      const d = sc.device;
      if (seen.has(d.hostname)) continue;
      seen.add(d.hostname);
      const owner = owners.get(sc.account.username) ?? sc.requester.name;
      out.push({ id: `d-${d.hostname}`, group: 'Devices', label: d.hostname, sub: `${d.model} · ${owner}`, icon: Laptop, hay: hay(d.hostname, d.model, owner), to: `/devices/${d.hostname}` });
    }
    for (const a of [...KB_ARTICLES, ...state.customKb]) {
      out.push({ id: `k-${a.id}`, group: 'Knowledge base', label: a.title, sub: a.category, icon: FileText, hay: hay(a.title, a.category, a.tags.join(' '), 'kb article'), to: `/kb/${a.id}` });
    }
    return out;
  }, [scenarios, works, state.customKb, state.settings.theme, dispatch, navigate, onShortcuts]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const buckets = new Map<string, { e: Entry; s: number }[]>();
    for (const e of entries) {
      // With nothing typed: your tickets, actions and pages only.
      if (!words.length && !['Your tickets', 'Actions', 'Pages'].includes(e.group)) continue;
      const s = words.length ? score(e, words) : 0;
      if (s < 0) continue;
      const b = buckets.get(e.group) ?? [];
      b.push({ e, s });
      buckets.set(e.group, b);
    }
    return GROUPS.flatMap((g) => {
      const b = buckets.get(g) ?? [];
      const limit = !words.length && g === 'Pages' ? 99 : PER_GROUP;
      return b
        .sort((x, y) => y.s - x.s)
        .slice(0, limit)
        .map((x) => x.e);
    });
  }, [entries, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    if (e.to) navigate(e.to);
    e.run?.();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const n = results.length;
      if (n) setActive((a) => (a + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      go(results[active]);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      onClose();
    } else if (ev.key === 'Home' && ev.ctrlKey) {
      setActive(0);
    }
  };

  let lastGroup = '';
  return createPortal(
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div ref={ref} className="cmdk" role="dialog" aria-modal="true" aria-label="Search and jump to" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="cmdk-input">
          <Search size={18} aria-hidden />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `cmdk-${results[active].id}` : undefined}
            placeholder="Search tickets, people, devices, articles or pages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" aria-label="Results" ref={listRef}>
          {results.length === 0 && <p className="cmdk-empty">Nothing matches “{q}”. Try a name, a ticket number or a hostname.</p>}
          {results.map((e, i) => {
            const head = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            const Icon = e.icon;
            return (
              <Fragment key={e.id}>
                {head && (
                  <div className="cmdk-group" role="presentation">
                    {head}
                  </div>
                )}
                <div
                  id={`cmdk-${e.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  className={`cmdk-item ${i === active ? 'active' : ''}`}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => go(e)}
                >
                  <Icon size={16} aria-hidden />
                  <span className="cmdk-text">
                    <span className="cmdk-label">{e.label}</span>
                    {e.sub && <span className="cmdk-sub">{e.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft size={14} className="cmdk-enter" aria-hidden />}
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="cmdk-foot" aria-hidden>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>{MOD_KEY}</kbd>
            <kbd>K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
