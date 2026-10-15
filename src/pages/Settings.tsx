import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { downloadJson, normalizeState } from '../state/storage';
import { Modal } from '../components/ui';
import { APP_NAME } from '../config';

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.profile?.name ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = state.settings;

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Everything is stored locally in this browser. Nothing is sent to a server.</p>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Profile</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'setProfile', name });
            setMsg('Name updated.');
          }}
        >
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, width: 'auto' }} aria-label="Your name" maxLength={40} />
          <button className="btn btn-primary">Save</button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Preferences</h2>
        <label className="field">
          Theme
          <select value={s.theme} onChange={(e) => dispatch({ type: 'settings', patch: { theme: e.target.value as typeof s.theme } })}>
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={s.voice} onChange={(e) => dispatch({ type: 'settings', patch: { voice: e.target.checked } })} />
          <span>
            <strong>Spoken voices</strong>
            <span className="muted small"> for voice calls and interview questions</span>
          </span>
        </label>
        <label className="field">
          Voice speed: {s.voiceRate.toFixed(1)}×
          <input type="range" min={0.7} max={1.4} step={0.1} value={s.voiceRate} onChange={(e) => dispatch({ type: 'settings', patch: { voiceRate: Number(e.target.value) } })} />
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={s.hints} onChange={(e) => dispatch({ type: 'settings', patch: { hints: e.target.checked } })} />
          <span>
            <strong>Show hint button</strong>
            <span className="muted small"> (each hint costs 3 points)</span>
          </span>
        </label>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Your data</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Back up your progress, or move it to another browser or device.
        </p>
        <div className="row">
          <button className="btn" onClick={() => downloadJson(`${APP_NAME.toLowerCase()}-progress.json`, state)}>
            ⬇ Export progress
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
                setMsg('Progress imported.');
              } catch {
                setMsg('That file could not be imported.');
              }
            }}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Import progress
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        </div>
        {msg && <div className="callout small">{msg}</div>}
      </div>

      <div className="card small muted">
        {APP_NAME} is an independent, original training simulator. All companies, people and incidents are fictional.
      </div>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h2>Reset all progress?</h2>
          <p>This deletes your ticket history, calls, interviews, shifts, badges and custom scenarios. Your name and settings are kept.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'reset' });
                setConfirmReset(false);
                setMsg('Progress reset.');
              }}
            >
              Yes, reset
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
