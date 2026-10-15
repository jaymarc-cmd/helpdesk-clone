import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACTIONS } from '../data/actions';
import { KB_ARTICLES } from '../data/kb';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { SCENARIO_TEMPLATE, validateScenario } from '../engine/validate';
import { useStore } from '../state/store';
import { downloadJson } from '../state/storage';
import { TEAMS, type Scenario } from '../types';

const pretty = (o: unknown) => JSON.stringify(o, null, 2);

export function Builder() {
  const { state, dispatch } = useStore();
  const [json, setJson] = useState(pretty(SCENARIO_TEMPLATE));
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const takenIds = (selfId?: string | null) =>
    [...BUILTIN_SCENARIOS.map((s) => s.id), ...state.customScenarios.map((s) => s.id)].filter((id) => id !== selfId);

  const load = (s: object, id: string | null) => {
    const { custom: _c, ...rest } = s as Scenario;
    void _c;
    setJson(pretty(rest));
    setEditing(id);
    setErrors([]);
    setWarnings([]);
    setSaved(null);
  };

  const save = () => {
    setSaved(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setErrors([`Invalid JSON: ${(e as Error).message}`]);
      return;
    }
    const res = validateScenario(parsed, takenIds(editing));
    setErrors(res.errors);
    setWarnings(res.warnings);
    if (res.ok && res.scenario) {
      if (editing && editing !== res.scenario.id) dispatch({ type: 'deleteScenario', id: editing });
      dispatch({ type: 'saveScenario', scenario: res.scenario });
      setEditing(res.scenario.id);
      setSaved(res.scenario.id);
    }
  };

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : [data];
      const errs: string[] = [];
      let n = 0;
      for (const item of list) {
        const res = validateScenario(item, takenIds(item?.id && state.customScenarios.some((s) => s.id === item.id) ? item.id : null));
        if (res.ok && res.scenario) {
          dispatch({ type: 'saveScenario', scenario: res.scenario });
          n++;
        } else errs.push(`${item?.id ?? '(no id)'}: ${res.errors[0]}`);
      }
      setErrors(errs);
      setSaved(n ? `${n} scenario(s) imported` : null);
    } catch (e) {
      setErrors([`Could not read file: ${(e as Error).message}`]);
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Scenario Builder</h1>
          <p>Write your own tickets, or share packs with your class or team as JSON. Custom tickets appear in the queue and in shifts.</p>
        </div>
        <div className="row">
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Import JSON
          </button>
          <button className="btn" disabled={!state.customScenarios.length} onClick={() => downloadJson('tierone-scenarios.json', state.customScenarios)}>
            ⬇ Export all
          </button>
        </div>
      </div>

      <div className="split-main">
        <div className="card stack">
          <div className="spread">
            <strong>{editing ? `Editing: ${editing}` : 'New scenario'}</strong>
            <div className="row">
              <select
                aria-label="Start from"
                style={{ width: 'min(260px, 70vw)' }}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__template') load(SCENARIO_TEMPLATE, null);
                  else {
                    const b = BUILTIN_SCENARIOS.find((s) => s.id === v);
                    if (b) load({ ...b, id: `${b.id}-copy`, title: `${b.title} (copy)` }, null);
                  }
                }}
              >
                <option value="">Start from…</option>
                <option value="__template">Blank template</option>
                <optgroup label="Copy a built-in ticket">
                  {BUILTIN_SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
          <textarea className="json-editor" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Scenario JSON" />
          {errors.length > 0 && (
            <div className="callout danger small">
              <strong>Fix these before saving:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="callout warning small">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
          {saved && (
            <div className="callout success small spread">
              <span>✓ Saved {saved}.</span>
              {state.customScenarios.some((s) => s.id === saved) && (
                <Link to={`/ticket/${saved}`} className="btn btn-sm btn-primary">
                  Play it now
                </Link>
              )}
            </div>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={save}>
              Validate &amp; save
            </button>
            <button className="btn" onClick={() => load(SCENARIO_TEMPLATE, null)}>
              Reset
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Your scenarios ({state.customScenarios.length})</h3>
            {state.customScenarios.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                None yet. Edit the template and save.
              </p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {state.customScenarios.map((s) => (
                  <div key={s.id} className="card card-tight">
                    <div className="small" style={{ fontWeight: 700 }}>
                      {s.title}
                    </div>
                    <div className="tiny muted mono">{s.id}</div>
                    <div className="row" style={{ marginTop: 6, gap: 6 }}>
                      <Link className="btn btn-sm" to={`/ticket/${s.id}`}>
                        Play
                      </Link>
                      <button className="btn btn-sm" onClick={() => load(s, s.id)}>
                        Edit
                      </button>
                      <button className="btn btn-sm" onClick={() => downloadJson(`${s.id}.json`, s)}>
                        Export
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          if (confirm(`Delete "${s.title}"?`)) dispatch({ type: 'deleteScenario', id: s.id });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Reference: action ids</summary>
            <ul className="tiny mono" style={{ paddingLeft: 16, marginBottom: 0 }}>
              {ACTIONS.map((a) => (
                <li key={a.id} title={a.label}>
                  {a.id} <span className="muted">({a.tool})</span>
                </li>
              ))}
            </ul>
          </details>
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Reference: teams &amp; KB ids</summary>
            <div className="tiny mt">
              <strong>escalateTo</strong>
              <ul className="mono" style={{ paddingLeft: 16 }}>
                {TEAMS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <strong>kb</strong>
              <ul className="mono" style={{ paddingLeft: 16, marginBottom: 0 }}>
                {KB_ARTICLES.map((a) => (
                  <li key={a.id}>{a.id}</li>
                ))}
              </ul>
            </div>
          </details>
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>How grading uses your fields</summary>
            <ul className="small" style={{ paddingLeft: 16, marginBottom: 0 }}>
              <li>
                <strong>keyFacts</strong>: investigation score. Reveal them via questions, terminal output, tool panels or action results.
              </li>
              <li>
                <strong>requiredActions</strong>: resolution score. Use <code>"a|b"</code> when either action works.
              </li>
              <li>
                <strong>harmfulActions</strong>: −10 each. Other unlisted actions count as unnecessary.
              </li>
              <li>
                <strong>noteKeywords / replyKeywords</strong>: documentation and communication checks.
              </li>
              <li>
                Questions with <code>"quality": "bad"</code> cost communication points.
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
