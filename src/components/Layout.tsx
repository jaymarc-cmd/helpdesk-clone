import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowRight, Award, ClipboardCheck, HardDrive, Headset, type LucideIcon, Menu, ScanSearch, Search, TriangleAlert, X } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '../config';
import { rankFor, totalXp } from '../engine/progress';
import { useStore } from '../state/store';
import { BadgeGlyph } from './icons';
import { IconTile, Modal, ProgressBar, initials, useDialogFocus } from './ui';
import { ActiveTicketBar, ShiftAlerts } from './work';
import { NAV, ShortcutsDialog, SkipLink, useGlobalShortcuts, useRouteChange } from './shell';
import { CommandPalette, MOD_KEY } from './palette';
import '../styles/shell-dashboard.css';

const WELCOME_POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ScanSearch,
    title: 'Work like a Tier 1 analyst',
    text: 'Pick up tickets, then fix them in real tools: Directory, Server room, Remote desktop and Deployment.',
  },
  {
    icon: ClipboardCheck,
    title: 'Get graded on every ticket',
    text: 'Diagnosis, process, security, communication and notes are scored separately.',
  },
  {
    icon: Award,
    title: 'Build your rank',
    text: 'Earn XP, ranks and badges as you close tickets, calls and shifts.',
  },
];

const BADGE_PREFIX = 'Badge earned:';

function NavList({ shiftLive, onNavigate }: { shiftLive: boolean; onNavigate?: () => void }) {
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((item, i) => {
        if ('section' in item) {
          return (
            <div className="nav-section" key={i}>
              {item.section}
            </div>
          );
        }
        const Icon = item.icon;
        const live = item.to === '/shift' && shiftLive;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={!!item.end}
            title={item.label}
            aria-label={live ? `${item.label}, shift in progress` : item.label}
            className={({ isActive }) => [isActive ? 'active' : '', live ? 'nav-live' : ''].filter(Boolean).join(' ')}
            onClick={onNavigate}
          >
            <Icon size={18} aria-hidden />
            <span className="nav-label">{item.label}</span>
            {live && <span className="nav-badge live-dot nav-label">Live</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Phones and small tablets: the full, labelled navigation slides in from the side. */
function MobileMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return createPortal(
    <div className="mnav-backdrop" onMouseDown={onClose}>
      <div ref={ref} id="mnav" className="mnav" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mnav-head">
          <span className="brand-name">{APP_NAME}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu">
            <X size={20} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Layout() {
  const { state, dispatch, toast, dismissToast, saveFailed } = useStore();
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const [name, setName] = useState('');
  const displayName = state.profile?.name ?? 'Analyst';
  const shiftLive = !!state.activeShift;

  useRouteChange();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const openPalette = useCallback(() => {
    setHelp(false);
    setMenu(false);
    setPalette(true);
  }, []);
  const openHelp = useCallback(() => setHelp(true), []);
  useGlobalShortcuts({ openPalette, openHelp });

  const profileCard = (
    <div className="sidebar-footer">
      <div className="who">
        <span className="who-avatar" aria-hidden>
          {initials(displayName)}
        </span>
        <div className="who-text">
          <div className="name">{displayName}</div>
          <div className="rank">
            Level {rank.level} · {rank.current.title}
          </div>
        </div>
      </div>
      <ProgressBar value={rank.progress} />
      <div className="xp" title={rank.next ? `${rank.next.xp - xp} XP to ${rank.next.title}` : 'Top rank reached'}>
        <span>{xp.toLocaleString('en-US')} XP</span>
        <span>{rank.next ? `${(rank.next.xp - xp).toLocaleString('en-US')} to Level ${rank.level + 1}` : 'Max rank'}</span>
      </div>
    </div>
  );

  const toastIsBadge = !!toast && toast.text.startsWith(BADGE_PREFIX);
  const toastTitle = toast ? (toastIsBadge ? toast.text.slice(BADGE_PREFIX.length).trim() : toast.text) : '';

  return (
    <div className="app">
      <SkipLink />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Headset size={18} aria-hidden />
          </div>
          <div className="brand-text">
            <div className="brand-name">{APP_NAME}</div>
            <small>{APP_TAGLINE}</small>
          </div>
        </div>

        <button type="button" className="nav-search" onClick={openPalette} aria-label="Search and jump to" aria-keyshortcuts="Control+K Meta+K">
          <Search size={16} aria-hidden />
          <span className="nav-label">Search</span>
          <kbd className="nav-label">{MOD_KEY} K</kbd>
        </button>

        <button
          type="button"
          className={`mnav-toggle ${shiftLive ? 'live' : ''}`}
          onClick={() => setMenu(true)}
          aria-expanded={menu}
          aria-controls="mnav"
        >
          <Menu size={18} aria-hidden />
          Menu
        </button>

        <NavList shiftLive={shiftLive} />

        {profileCard}
      </aside>

      <main className="main" id="main" tabIndex={-1}>
        <div className="main-inner">
          {saveFailed && (
            <div className="callout warning save-warning" role="alert">
              <TriangleAlert size={18} aria-hidden />
              <div className="callout-body">
                <strong>Progress isn't being saved.</strong> This browser's storage is full or blocked, so closing the tab loses your work.{' '}
                <Link to="/settings">Export a backup</Link> or free up space.
              </div>
            </div>
          )}
          <ActiveTicketBar />
          <ShiftAlerts />
          <Outlet />
        </div>
      </main>

      {!state.profile && (
        <Modal labelledBy="onboard-title">
          <div className="onboard">
            <div className="hero onboard-hero">
              <div className="onboard-brand">
                <div className="brand-mark">
                  <Headset size={22} aria-hidden />
                </div>
                <div className="onboard-brand-text">
                  <div className="brand-tagline">{APP_TAGLINE}</div>
                  <h2 id="onboard-title">Welcome to {APP_NAME}</h2>
                </div>
              </div>
              <p>
                You've just joined the service desk at <strong>Harbor &amp; Pine Logistics</strong>. Work real-world tickets, take
                voice calls, run full shifts and practice interviews, all free and all in your browser.
              </p>
            </div>

            <ul className="onboard-points">
              {WELCOME_POINTS.map((p) => (
                <li key={p.title}>
                  <IconTile icon={p.icon} tone="primary" />
                  <div className="onboard-point-text">
                    <strong>{p.title}</strong>
                    <span>{p.text}</span>
                  </div>
                </li>
              ))}
            </ul>

            <form
              className="onboard-form"
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: 'setProfile', name });
              }}
            >
              <label className="field">
                What should we call you?
                <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
                <span className="hint">Shown in the sidebar and on your dashboard. You can change it later in Settings.</span>
              </label>
              <button className="btn btn-primary btn-lg btn-block" type="submit">
                Start my first day
                <ArrowRight size={16} aria-hidden />
              </button>
              <p className="onboard-note">
                <HardDrive size={14} aria-hidden />
                Progress is stored in this browser only.
              </p>
            </form>
          </div>
        </Modal>
      )}

      {menu && (
        <MobileMenu onClose={closeMenu}>
          <NavList shiftLive={shiftLive} onNavigate={closeMenu} />
          {profileCard}
        </MobileMenu>
      )}
      {palette && <CommandPalette onClose={() => setPalette(false)} onShortcuts={openHelp} />}
      {help && <ShortcutsDialog onClose={() => setHelp(false)} modKey={MOD_KEY} />}

      {toast && (
        <div className="toast" role="status" onClick={dismissToast}>
          <span className="icon-tile tone-primary size-md" aria-hidden>
            <BadgeGlyph icon={toast.icon} size={18} />
          </span>
          <div className="toast-text">
            {toastTitle}
            {toastIsBadge && <span className="toast-sub">Badge earned</span>}
          </div>
          <button type="button" className="icon-btn toast-close" aria-label="Dismiss notification" onClick={dismissToast}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
