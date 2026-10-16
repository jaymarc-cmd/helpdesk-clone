import { useRef, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  Download,
  Gauge,
  Info,
  Lightbulb,
  Monitor,
  Moon,
  Palette,
  Save,
  Settings as Sun,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../state/store';
import { downloadJson, normalizeState } from '../state/storage';
import { IconTile, Modal, PageHeader, formatDate, initials } from '../components/ui';
import { APP_NAME, APP_TAGLINE } from '../config';
import type { Settings } from '../types';
import '../styles/progress-builder-settings.css';

type Notice = { text: string; tone: 'success' | 'danger'; where: 'profile' | 'data' };

const THEMES: { value: Settings['theme']; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function StatusNote({ notice }: { notice: Notice }) {
  const Icon = notice.tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <div className={`callout small ${notice.tone}`} role="status">
      <Icon size={16} aria-hidden />
      <div className="callout-body">{notice.text}</div>
    </div>
  );
}

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.profile?.name ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = state.settings;
  const shownName = state.profile?.name ?? name;

  const inventory: { label: string; value: number }[] = [
    { label: 'Ticket attempts', value: state.tickets.length },
    { label: 'Voice calls', value: state.calls.length },
    { label: 'Interviews', value: state.interviews.length },
    { label: 'Shifts', value: state.shifts.length },
    { label: 'Badges', value: state.badges.length },
    { label: 'Custom scenarios', value: state.customScenarios.length },
  ];

  return (
    <div className="page page-narrow pbs-page pbs-settings">
      <PageHeader
        title="Settings"
        description="Everything is stored locally in this browser. Nothing is sent to a server."
      />

      <section className="card" aria-labelledby="pbs-profile-h">
        <div className="card-head">
          <h2 id="pbs-profile-h">
            Profile
          </h2>
        </div>
        {state.profile?.createdAt && <p className="card-sub">Training since {formatDate(state.profile.createdAt)}.</p>}
        <div className="stack">
          <div className="pbs-profile">
            <span className="pbs-avatar" aria-hidden>
              {shownName.trim() ? initials(shownName) : <UserRound size={20} />}
            </span>
            <form
              className="pbs-profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: 'setProfile', name });
                setMsg({ text: 'Name updated.', tone: 'success', where: 'profile' });
              }}
            >
              <label className="pbs-field-label" htmlFor="pbs-name">
                Your name
              </label>
              <div className="pbs-name-row">
                <input
                  id="pbs-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  aria-describedby="pbs-name-hint"
                />
                <button type="submit" className="btn btn-primary">
                  <Save size={16} aria-hidden />
                  Save
                </button>
              </div>
              <span className="hint" id="pbs-name-hint">
                Shown in the sidebar, on your dashboard and on your printed training record.
              </span>
            </form>
          </div>
          {msg?.where === 'profile' && <StatusNote notice={msg} />}
        </div>
      </section>

      <section className="card" aria-labelledby="pbs-prefs-h">
        <div className="card-head">
          <h2 id="pbs-prefs-h">
            Preferences
          </h2>
        </div>
        <div className="pbs-prefs">
          <div className="pbs-pref pbs-pref-wide">
            <IconTile icon={Palette} tone="neutral" size="sm" />
            <div className="pbs-pref-text">
              <span className="pbs-pref-title" id="pbs-theme-label">
                Theme
              </span>
              <span className="pbs-pref-desc">Match your system setting, or always use light or dark.</span>
            </div>
            <div className="pbs-pref-control">
              <div className="seg" role="group" aria-labelledby="pbs-theme-label">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={s.theme === value ? 'active' : ''}
                    aria-pressed={s.theme === value}
                    onClick={() => dispatch({ type: 'settings', patch: { theme: value } })}
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="pbs-pref">
            <IconTile icon={Volume2} tone={s.voice ? 'primary' : 'neutral'} size="sm" />
            <span className="pbs-pref-text">
              <span className="pbs-pref-title">Spoken voices</span>
              <span className="pbs-pref-desc">Read callers and interview questions aloud during voice calls and mock interviews.</span>
            </span>
            <span className="pbs-pref-control">
              <input
                type="checkbox"
                role="switch"
                className="pbs-switch"
                checked={s.voice}
                onChange={(e) => dispatch({ type: 'settings', patch: { voice: e.target.checked } })}
              />
            </span>
          </label>

          <div className="pbs-pref pbs-pref-wide">
            <IconTile icon={Gauge} tone={s.voice ? 'primary' : 'neutral'} size="sm" />
            <div className="pbs-pref-text">
              <label className="pbs-pref-title" htmlFor="pbs-voice-rate">
                Voice speed
                <span className="pill pill-outline mono">{s.voiceRate.toFixed(1)}×</span>
              </label>
              <span className="pbs-pref-desc">
                {s.voice ? 'How fast callers and interviewers speak.' : 'Applies when spoken voices are turned on.'}
              </span>
            </div>
            <div className="pbs-pref-control">
              <span className="tiny faint mono" aria-hidden>
                0.7×
              </span>
              <input
                id="pbs-voice-rate"
                className="pbs-range"
                type="range"
                min={0.7}
                max={1.4}
                step={0.1}
                value={s.voiceRate}
                aria-valuetext={`${s.voiceRate.toFixed(1)} times normal speed`}
                onChange={(e) => dispatch({ type: 'settings', patch: { voiceRate: Number(e.target.value) } })}
              />
              <span className="tiny faint mono" aria-hidden>
                1.4×
              </span>
            </div>
          </div>

          <label className="pbs-pref">
            <IconTile icon={Lightbulb} tone={s.hints ? 'primary' : 'neutral'} size="sm" />
            <span className="pbs-pref-text">
              <span className="pbs-pref-title">Show hint button</span>
              <span className="pbs-pref-desc">Offers hints inside tickets. Each hint used costs 3 points.</span>
            </span>
            <span className="pbs-pref-control">
              <input
                type="checkbox"
                role="switch"
                className="pbs-switch"
                checked={s.hints}
                onChange={(e) => dispatch({ type: 'settings', patch: { hints: e.target.checked } })}
              />
            </span>
          </label>
        </div>
      </section>

      <section className="card" aria-labelledby="pbs-data-h">
        <div className="card-head">
          <h2 id="pbs-data-h">
            Your data
          </h2>
        </div>
        <p className="card-sub">Back up your progress, or move it to another browser or device.</p>
        <div className="pbs-body">
          <ul className="pbs-inventory" aria-label="Stored in this browser">
            {inventory.map((it) => (
              <li key={it.label}>
                <span className="pbs-inventory-value">{it.value}</span>
                <span className="pbs-inventory-label">{it.label}</span>
              </li>
            ))}
          </ul>
          <div className="pbs-btn-row pbs-data-actions">
            <button type="button" className="btn download-btn" onClick={() => downloadJson(`${APP_NAME.toLowerCase()}-progress.json`, state)}>
              <Download size={16} aria-hidden />
              Export progress
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  dispatch({ type: 'import', state: normalizeState(JSON.parse(await f.text())) });
                  setMsg({ text: 'Progress imported.', tone: 'success', where: 'data' });
                } catch {
                  setMsg({ text: 'That file could not be imported.', tone: 'danger', where: 'data' });
                }
              }}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden />
              Import progress
            </button>
          </div>
          {msg?.where === 'data' && <StatusNote notice={msg} />}
          <div className="pbs-danger-zone">
            <div className="pbs-danger-zone-text">
              <strong>Reset progress</strong>
              <span className="small muted">Deletes your history, badges and custom scenarios. Your name and settings are kept.</span>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              <Trash2 size={16} aria-hidden />
              Reset progress
            </button>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="pbs-about-h">
        <div className="pbs-about">
          <IconTile icon={Info} tone="info" size="md" />
          <div className="pbs-about-text">
            <strong id="pbs-about-h">
              {APP_NAME} · {APP_TAGLINE}
            </strong>
            <span>{APP_NAME} is an independent, original training simulator. All companies, people and incidents are fictional.</span>
          </div>
        </div>
      </section>

      {confirmReset && (
        <Modal title="Reset all progress?" onClose={() => setConfirmReset(false)}>
          <div className="stack">
            <p className="pbs-modal-text">
              This deletes your ticket history, calls, interviews, shifts, badges and custom scenarios. Your name and settings are kept.
            </p>
            <ul className="pbs-reset-summary" aria-label="Will be deleted">
              {inventory.map((it) => (
                <li key={it.label} className={it.value ? '' : 'zero'}>
                  <span className="pbs-inventory-value">{it.value}</span>
                  <span className="pbs-inventory-label">{it.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setConfirmReset(false)} autoFocus>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'reset' });
                setConfirmReset(false);
                setMsg({ text: 'Progress reset.', tone: 'success', where: 'data' });
              }}
            >
              <Trash2 size={16} aria-hidden />
              Yes, reset
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
