import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  ListChecks,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Scale,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';
import { ACTIONS } from '../data/actions';
import { KB_ARTICLES } from '../data/kb';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { SCENARIO_TEMPLATE, validateScenario } from '../engine/validate';
import { useStore } from '../state/store';
import { downloadJson } from '../state/storage';
import { TEAMS, type Scenario } from '../types';
import { CategoryIcon } from '../components/icons';
import { EmptyState, Modal, PageHeader, PriorityPill } from '../components/ui';
import '../styles/progress-builder-settings.css';

const pretty = (o: unknown) => JSON.stringify(o, null, 2);

/** Validation messages start with the quoted field name; show it as code so the list scans quickly. */
function FieldMessage({ text }: { text: string }) {
  const m = /^"([^"]+)"([\s\S]*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <code>{m[1]}</code>
      {m[2]}
    </>
  );
}

export function Builder() {
  const { state, dispatch } = useStore();
  const [json, setJson] = useState(pretty(SCENARIO_TEMPLATE));
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Scenario | null>(null);
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

  const confirmDelete = () => {
    if (pendingDelete) dispatch({ type: 'deleteScenario', id: pendingDelete.id });
    setPendingDelete(null);
  };

  const savedIsScenario = saved !== null && state.customScenarios.some((s) => s.id === saved);
  const savedIsImport = saved !== null && saved.endsWith(' imported');
  const count = state.customScenarios.length;

  return (
    <div className="pbs-page pbs-builder">
      <PageHeader
        eyebrow={
          <>
            <Wrench size={14} aria-hidden />
            <span>Authoring</span>
          </>
        }
        title="Scenario Builder"
        description="Write your own tickets, or share packs with your class or team as JSON. Custom tickets appear in the queue and in shifts."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden />
              Import JSON
            </button>
            <button
              type="button"
              className="btn download-btn"
              disabled={!count}
              onClick={() => downloadJson('tierone-scenarios.json', state.customScenarios)}
            >
              <Download size={16} aria-hidden />
              Export all
            </button>
          </>
        }
      />

      <div className="split-main">
        <section className="card stack" aria-labelledby="pbs-editor-h">
          <div className="card-head pbs-flush">
            <div className="pbs-head-title">
              <h2 id="pbs-editor-h">
                <FileJson size={18} aria-hidden />
                {editing ? 'Editing scenario' : 'New scenario'}
              </h2>
              {editing && (
                <span className="pill pill-primary pbs-idpill" title={editing}>
                  {editing}
                </span>
              )}
            </div>
            <label className="pbs-startfrom">
              <span className="label">Start from</span>
              <select
                aria-label="Start from"
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
                <option value="">Choose a starting point…</option>
                <option value="__template">Blank template</option>
                <optgroup label="Copy a built-in ticket">
                  {BUILTIN_SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          <textarea className="json-editor" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Scenario JSON" />

          {errors.length > 0 && (
            <div className="callout danger small" role="alert">
              <CircleAlert size={16} aria-hidden />
              <div className="callout-body">
                <strong>{errors.length === 1 ? 'Fix this before saving' : `Fix these ${errors.length} problems before saving`}</strong>
                <ul className="pbs-msg-list">
                  {errors.map((e, i) => (
                    <li key={i}>
                      <FieldMessage text={e} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="callout warning small">
              <TriangleAlert size={16} aria-hidden />
              <div className="callout-body">
                <strong>{warnings.length === 1 ? 'Warning' : `${warnings.length} warnings`}</strong>
                <ul className="pbs-msg-list">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <FieldMessage text={w} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {saved && (
            <div className="callout success small pbs-callout-center" role="status">
              <CircleCheck size={16} aria-hidden />
              <div className="callout-body pbs-saved">
                <span>
                  {savedIsImport ? (
                    `${saved}.`
                  ) : (
                    <>
                      Saved <code>{saved}</code>.
                    </>
                  )}
                </span>
                {savedIsScenario && (
                  <Link to={`/ticket/${saved}`} className="btn btn-sm btn-primary">
                    <Play size={14} aria-hidden />
                    Play it now
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="pbs-editor-foot">
            <div className="pbs-btn-row">
              <button type="button" className="btn btn-primary" onClick={save}>
                <Save size={16} aria-hidden />
                Validate &amp; save
              </button>
              <button type="button" className="btn" onClick={() => load(SCENARIO_TEMPLATE, null)}>
                <RotateCcw size={16} aria-hidden />
                Reset
              </button>
            </div>
            <span className="tiny muted">Saving checks every field against the grading rules.</span>
          </div>
        </section>

        <div className="pbs-side">
          <section className="card" aria-labelledby="pbs-yours-h">
            <div className="card-head">
              <h2 id="pbs-yours-h">
                <FolderOpen size={18} aria-hidden />
                Your scenarios
              </h2>
              <span className={`pill ${count ? 'pill-primary' : ''} num`}>{count}</span>
            </div>
            {count === 0 ? (
              <EmptyState icon={FilePlus2} title="No custom scenarios yet">
                Edit the template and save it to add your first ticket.
              </EmptyState>
            ) : (
              <ul className="pbs-scn-list">
                {state.customScenarios.map((s) => {
                  const isEditing = editing === s.id;
                  return (
                    <li key={s.id} className={`pbs-scn ${isEditing ? 'editing' : ''}`}>
                      <div className="pbs-scn-main">
                        <div className="pbs-scn-title">{s.title}</div>
                        <div className="pbs-scn-id">{s.id}</div>
                        <div className="pbs-scn-meta">
                          <span className="inline-icon">
                            <CategoryIcon category={s.category} size={13} />
                            {s.category}
                          </span>
                          {s.priority && <PriorityPill p={s.priority} />}
                          {isEditing && <span className="pill pill-primary">In editor</span>}
                        </div>
                      </div>
                      <div className="pbs-scn-actions">
                        <Link className="btn btn-sm" to={`/ticket/${s.id}`}>
                          <Play size={14} aria-hidden />
                          Play
                        </Link>
                        <div className="pbs-scn-icons">
                          <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${s.title}`} onClick={() => load(s, s.id)}>
                            <Pencil size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="icon-btn download-btn"
                            title="Export as JSON"
                            aria-label={`Export ${s.title} as JSON`}
                            onClick={() => downloadJson(`${s.id}.json`, s)}
                          >
                            <Download size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="icon-btn pbs-icon-danger"
                            title="Delete"
                            aria-label={`Delete ${s.title}`}
                            onClick={() => setPendingDelete(s)}
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <details className="card pbs-ref">
            <summary>
              <ChevronRight className="chev" size={16} aria-hidden />
              <ListChecks className="pbs-ref-icon" size={16} aria-hidden />
              Reference: action ids
              <span className="pill num pbs-ref-count">{ACTIONS.length}</span>
            </summary>
            <div className="pbs-ref-body">
              <ul className="pbs-ref-list">
                {ACTIONS.map((a) => (
                  <li key={a.id} title={a.label}>
                    <span>{a.id}</span>
                    <span>{a.tool}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <details className="card pbs-ref">
            <summary>
              <ChevronRight className="chev" size={16} aria-hidden />
              <Users className="pbs-ref-icon" size={16} aria-hidden />
              Reference: teams &amp; KB ids
            </summary>
            <div className="pbs-ref-body">
              <div className="pbs-ref-group">
                <div className="pbs-ref-sub">
                  <code>escalateTo</code>
                  <span className="tiny muted">team names</span>
                </div>
                <ul className="pbs-ref-list">
                  {TEAMS.map((t) => (
                    <li key={t}>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pbs-ref-group">
                <div className="pbs-ref-sub">
                  <code>kb</code>
                  <span className="tiny muted">article ids</span>
                </div>
                <ul className="pbs-ref-list">
                  {KB_ARTICLES.map((a) => (
                    <li key={a.id} title={a.title}>
                      <span>{a.id}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <details className="card pbs-ref">
            <summary>
              <ChevronRight className="chev" size={16} aria-hidden />
              <Scale className="pbs-ref-icon" size={16} aria-hidden />
              How grading uses your fields
            </summary>
            <div className="pbs-ref-body">
              <ul className="pbs-grading">
                <li>
                  <code>keyFacts</code>
                  <span>Investigation score. Reveal them via questions, terminal output, tool panels or action results.</span>
                </li>
                <li>
                  <code>requiredActions</code>
                  <span>
                    Resolution score. Use <code>"a|b"</code> when either action works.
                  </span>
                </li>
                <li>
                  <code>harmfulActions</code>
                  <span>−10 each. Other unlisted actions count as unnecessary.</span>
                </li>
                <li>
                  <code>noteKeywords / replyKeywords</code>
                  <span>Documentation and communication checks.</span>
                </li>
                <li>
                  <code>questions</code>
                  <span>
                    Questions with <code>"quality": "bad"</code> cost communication points.
                  </span>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      {pendingDelete && (
        <Modal title="Delete scenario?" onClose={() => setPendingDelete(null)}>
          <div className="stack">
            <div className="pbs-modal-subject">
              <CategoryIcon category={pendingDelete.category} size={18} />
              <div className="pbs-modal-subject-text">
                <strong>{pendingDelete.title}</strong>
                <span className="pbs-scn-id">{pendingDelete.id}</span>
              </div>
            </div>
            <p className="pbs-modal-text">
              It will be removed from this browser and will no longer appear in the queue or in new shifts. Export it first if you want to
              keep a copy.
            </p>
            <div className="pbs-modal-actions">
              <button type="button" className="btn" onClick={() => setPendingDelete(null)} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                <Trash2 size={16} aria-hidden />
                Delete scenario
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
