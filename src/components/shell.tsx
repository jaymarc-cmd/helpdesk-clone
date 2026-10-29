import { Fragment, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  Award,
  Boxes,
  ChartNoAxesColumn,
  GraduationCap,
  IdCard,
  Inbox,
  LayoutDashboard,
  LibraryBig,
  type LucideIcon,
  MonitorSmartphone,
  PackageCheck,
  PhoneCall,
  Server,
  Settings,
  Stamp,
  Timer,
  Wrench,
} from 'lucide-react';
import { useStore } from '../state/store';
import { Modal } from './ui';

export type NavLinkItem = { to: string; icon: LucideIcon; label: string; end?: boolean; keywords?: string };
export type NavItem = { section: string } | NavLinkItem;

export const NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, keywords: 'home overview' },
  { section: 'Workstation' },
  { to: '/tickets', icon: Inbox, label: 'Ticketing', keywords: 'queue tickets incidents' },
  { to: '/directory', icon: IdCard, label: 'Directory', keywords: 'users accounts people active directory password unlock' },
  { to: '/servers', icon: Server, label: 'Server room', keywords: 'servers services restart infrastructure' },
  { to: '/devices', icon: MonitorSmartphone, label: 'Remote desktop', keywords: 'devices laptops computers remote' },
  { to: '/deploy', icon: PackageCheck, label: 'Deployment', keywords: 'software install push packages' },
  { to: '/approvals', icon: Stamp, label: 'Approvals', keywords: 'requests manager approval' },
  { to: '/assets', icon: Boxes, label: 'Assets', keywords: 'inventory loaner hardware stock' },
  { to: '/kb', icon: LibraryBig, label: 'Knowledge base', keywords: 'articles runbooks kb docs' },
  { to: '/calls', icon: PhoneCall, label: 'Phone', keywords: 'calls voice' },
  { section: 'Training' },
  { to: '/shift', icon: Timer, label: 'Shift mode', keywords: 'sla timed' },
  { to: '/interview', icon: GraduationCap, label: 'Mock interview', keywords: 'questions job' },
  { to: '/certification', icon: Award, label: 'Certification', keywords: 'exam certificate' },
  { to: '/progress', icon: ChartNoAxesColumn, label: 'Progress', keywords: 'stats skills badges xp rank' },
  { to: '/builder', icon: Wrench, label: 'Scenario builder', keywords: 'custom scenarios create' },
  { to: '/settings', icon: Settings, label: 'Settings', keywords: 'preferences theme backup export voice' },
];

export const NAV_LINKS = NAV.filter((x): x is NavLinkItem => 'to' in x);

/** Scroll position per history entry, so Back returns you to where you were. */
const scrollMemo = new Map<string, number>();

/**
 * What a page change should do for the person using it: start at the top (or where they were, going Back)
 * and put keyboard focus on the new page's heading, so screen readers announce it and Tab starts from there.
 */
export function useRouteChange() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const key = location.key;
    const onScroll = () => scrollMemo.set(key, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key]);

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = location.pathname;
    // First load, or only the query string changed (filters): leave scroll and focus alone.
    if (prev === null || prev === location.pathname) return;
    const saved = navType === 'POP' ? scrollMemo.get(location.key) : undefined;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, saved ?? 0);
      if (navType === 'POP') return;
      // A page that focused something itself (a search box) keeps it.
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest('.sidebar, .wk-bar, .cmdk, .mnav')) return;
      const h1 = document.querySelector<HTMLElement>('#main h1');
      if (!h1) return;
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname, navType]);
}

/** First stop for keyboard users: jump past the navigation. A button, because a #hash link would change the route. */
export function SkipLink() {
  return (
    <button
      type="button"
      className="skip-link"
      onClick={() => {
        const main = document.getElementById('main');
        main?.focus();
        main?.scrollIntoView();
      }}
    >
      Skip to content
    </button>
  );
}

/**
 * True when a single-letter shortcut should not fire: the person is typing, a dialog is open,
 * or they are working inside the simulated remote desktop (its own computer, its own keys).
 */
export function shortcutBlocked(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable="true"], .dt-frame')) return true;
  return !!document.querySelector('.modal-backdrop, .cmdk-backdrop, .mnav-backdrop');
}

/** When "g" was pressed: the next key picks where to go, and page shortcuts stand aside for it. */
let goPressedAt = 0;
const GO_WINDOW_MS = 1200;

/** A single-letter key meant for the current page (not typing, no dialog, not the second key of "g then …"). */
export function pageShortcut(e: KeyboardEvent): boolean {
  return !shortcutBlocked(e) && Date.now() - goPressedAt >= GO_WINDOW_MS;
}

const GO: Record<string, { to: string; label: string }> = {
  d: { to: '/', label: 'Dashboard' },
  t: { to: '/tickets', label: 'Ticket queue' },
  u: { to: '/directory', label: 'Directory' },
  s: { to: '/servers', label: 'Server room' },
  r: { to: '/devices', label: 'Remote desktop' },
  k: { to: '/kb', label: 'Knowledge base' },
  p: { to: '/progress', label: 'Progress' },
};

/** App-wide keys: Ctrl/Cmd+K search, ? for the list, and g-then-letter to jump between apps. */
export function useGlobalShortcuts({ openPalette, openHelp }: { openPalette: () => void; openHelp: () => void }) {
  const navigate = useNavigate();
  const { works } = useStore();
  const ticketIds = works.map((w) => w.scenario.id).join(',');
  useEffect(() => {
    const ids = ticketIds ? ticketIds.split(',') : [];
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (shortcutBlocked(e)) return;
      if (e.key === '?') {
        e.preventDefault();
        openHelp();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (Date.now() - goPressedAt < GO_WINDOW_MS) {
        // Cleared after this event has reached every listener, so page shortcuts see the sequence too.
        setTimeout(() => (goPressedAt = 0));
        const dest = GO[e.key] ?? (/^[1-3]$/.test(e.key) && ids[Number(e.key) - 1] ? { to: `/ticket/${ids[Number(e.key) - 1]}` } : null);
        if (dest) {
          e.preventDefault();
          navigate(dest.to);
        }
        return;
      }
      if (e.key === 'g') goPressedAt = Date.now();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, openPalette, openHelp, ticketIds]);
}

const SHORTCUTS: { group: string; keys: string[][]; text: string }[] = [
  { group: 'Anywhere', keys: [['MOD', 'K'], ['/']], text: 'Search and jump to anything' },
  { group: 'Anywhere', keys: [['?']], text: 'Show these shortcuts' },
  ...Object.entries(GO).map(([k, v]) => ({ group: 'Anywhere', keys: [['g', k]], text: `Go to ${v.label}` })),
  { group: 'Anywhere', keys: [['g', '1']], text: 'Go to your first open ticket (2 and 3 for the others)' },
  { group: 'On a ticket', keys: [['c']], text: 'Write a reply' },
  { group: 'On a ticket', keys: [['n']], text: 'Write a work note' },
  { group: 'On a ticket', keys: [['r']], text: 'Resolve the ticket' },
  { group: 'In the reply box', keys: [['Enter']], text: 'Send' },
  { group: 'In the reply box', keys: [['Shift', 'Enter']], text: 'New line' },
  { group: 'In dialogs', keys: [['Esc']], text: 'Close' },
];

export function ShortcutsDialog({ onClose, modKey }: { onClose: () => void; modKey: string }) {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="keys-dialog">
        {groups.map((g) => (
          <section key={g}>
            <h3>{g}</h3>
            <dl className="keys-list">
              {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                <Fragment key={s.text}>
                  <dt>
                    {s.keys.map((combo, i) => (
                      <span key={i} className="keys-combo">
                        {i > 0 && <span className="keys-or">or</span>}
                        {combo.map((k, j) => (
                          <Fragment key={j}>
                            {j > 0 && combo[0] === 'g' && <span className="keys-then">then</span>}
                            <kbd>{k === 'MOD' ? modKey : k}</kbd>
                          </Fragment>
                        ))}
                      </span>
                    ))}
                  </dt>
                  <dd>{s.text}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
        <p className="tiny muted">Single-letter keys are off while you type, while a dialog is open and inside the remote desktop.</p>
      </div>
    </Modal>
  );
}
