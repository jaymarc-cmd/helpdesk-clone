import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
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
