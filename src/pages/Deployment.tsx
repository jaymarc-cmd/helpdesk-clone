import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Package, Send } from 'lucide-react';
import { ACTION_BY_ID, actionsForTool } from '../data/actions';
import { useStore } from '../state/store';
import { PageHeader } from '../components/ui';
import { ActingFor, NoTicketNotice } from '../components/work';
import '../styles/workspace.css';
import '../styles/workstation.css';

/** Software deployment console: push approved packages to a managed device. */
export function Deployment() {
  const { scenarios, work } = useStore();
  const packages = actionsForTool('deploy');
  const hosts = useMemo(() => [...new Set(scenarios.map((s) => s.device.hostname))].sort(), [scenarios]);
  const [target, setTarget] = useState(work?.scenario.device.hostname ?? '');
  const editableTarget = !!work && target === work.scenario.device.hostname;
  const history = (work?.session.actionResults ?? []).filter((r) => ACTION_BY_ID[r.id]?.tool === 'deploy');

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        title="Deployment"
        description="Push approved software, updates and firmware to managed devices. Users don't need admin rights."
      />

      {work ? <ActingFor work={work} what={`device ${work.scenario.device.hostname}`} /> : <NoTicketNotice />}

      <section className="card">
        <div className="card-head">
          <h2>
            Target device
          </h2>
        </div>
        <div className="wk-deploy-target">
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target device">
            <option value="">Choose a device…</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h}
                {work?.scenario.device.hostname === h ? ' (your ticket)' : ''}
              </option>
            ))}
          </select>
          {target && !editableTarget && (
            <span className="small muted">
              Deployments are recorded against a ticket. {work ? 'Pick the device on your open ticket.' : <Link to="/tickets">Assign a ticket first.</Link>}
            </span>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            Approved packages
          </h2>
          <span className="pill num">{packages.length}</span>
        </div>
        <ul className="wk-packages">
          {packages.map((p) => {
            const done = !!work?.session.actions.includes(p.id);
            return (
              <li key={p.id} className={done ? 'done' : ''}>
                <Package size={18} aria-hidden />
                <span className="wk-pkg-text">
                  <span className="wk-pkg-name">{p.label}</span>
                  <span className="wk-pkg-desc">{p.description}</span>
                </span>
                {done ? (
                  <span className="pill pill-success">
                    <CircleCheck aria-hidden />
                    Deployed
                  </span>
                ) : (
                  <button className="btn btn-sm" disabled={!editableTarget} onClick={() => work?.emit({ type: 'action', actionId: p.id })}>
                    <Send size={14} aria-hidden />
                    Deploy
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {history.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              Deployment log
            </h2>
          </div>
          <div className="result-feed">
            {[...history].reverse().map((r, i) => (
              <div key={i} className="result-item">
                <strong>{ACTION_BY_ID[r.id]?.label}:</strong> {r.text}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
