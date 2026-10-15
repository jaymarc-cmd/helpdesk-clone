import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../config';
import { rankFor, totalXp } from '../engine/progress';
import { useStore } from '../state/store';
import { Modal, ProgressBar } from './ui';

const NAV = [
  { section: 'Practice' },
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/tickets', icon: '🎫', label: 'Ticket Queue' },
  { to: '/shift', icon: '⏱️', label: 'Shift Mode' },
  { to: '/calls', icon: '📞', label: 'Voice Calls' },
  { to: '/interview', icon: '💼', label: 'Mock Interview' },
  { section: 'Resources' },
  { to: '/kb', icon: '📖', label: 'Knowledge Base' },
  { to: '/progress', icon: '📈', label: 'Progress' },
  { to: '/builder', icon: '🛠️', label: 'Scenario Builder' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
] as const;

export function Layout() {
  const { state, dispatch, toast, dismissToast } = useStore();
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const [name, setName] = useState('');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">1</div>
          <div>
            {APP_NAME}
            <small>{APP_TAGLINE}</small>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((item, i) =>
            'section' in item ? (
              <div className="nav-section" key={i}>
                {item.section}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={'end' in item} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
                {item.to === '/shift' && state.activeShift && <span className="pill pill-danger nav-label">LIVE</span>}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="small" style={{ fontWeight: 700 }}>
            {state.profile?.name ?? 'Analyst'}
          </div>
          <div className="tiny muted mb" style={{ marginBottom: 8 }}>
            Lv {rank.level} · {rank.current.title}
          </div>
          <ProgressBar value={rank.progress} />
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {xp} XP{rank.next ? ` · ${rank.next.xp - xp} to ${rank.next.title}` : ' · Max rank'}
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {!state.profile && (
        <Modal>
          <div className="stack">
            <div className="brand" style={{ padding: 0 }}>
              <div className="brand-mark">1</div>
              <div>Welcome to {APP_NAME}</div>
            </div>
            <p>
              You've just joined the service desk at <strong>Harbor &amp; Pine Logistics</strong>. Work real-world tickets, take
              voice calls, run full shifts and practice interviews, all free and all in your browser.
            </p>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Investigate with chat, directory, endpoint and terminal tools</li>
              <li>Get graded on diagnosis, process, security, communication and notes</li>
              <li>Earn XP, ranks and badges as you go</li>
            </ul>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: 'setProfile', name });
              }}
            >
              <label className="field">
                What should we call you?
                <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
              </label>
              <button className="btn btn-primary btn-lg" type="submit">
                Start my first shift →
              </button>
            </form>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status" onClick={dismissToast}>
          <span style={{ fontSize: '1.4rem' }}>{toast.icon}</span>
          {toast.text}
        </div>
      )}
    </div>
  );
}
