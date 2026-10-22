import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { actionsForTool } from '../data/actions';
import { allAssets, type AssetStatus } from '../data/assets';
import { useStore } from '../state/store';
import { EmptyState, PageHeader } from '../components/ui';
import { ActingFor, ActionList, NoTicketNotice } from '../components/work';
import '../styles/workspace.css';
import '../styles/workstation.css';

const TONE: Record<AssetStatus, string> = { 'In use': 'pill-outline', 'In stock': 'pill-success', Loaned: 'pill-info', 'In repair': 'pill-warning' };

/** Hardware inventory: who has what, warranty dates, and the loaner and spares stock. */
export function AssetsPage() {
  const { scenarios, works, work } = useStore();
  const assets = useMemo(() => allAssets(scenarios), [scenarios]);
  const [q, setQ] = useState('');
  const list = assets.filter((a) => !q || `${a.tag} ${a.type} ${a.model} ${a.assignedTo} ${a.hostname ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const items = actionsForTool('assets').map((a) => ({ id: a.id, label: a.label, description: a.description }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page ws-root wk-app">
      <PageHeader title="Assets" description="Laptops, desktops, docks and phones: who has them, warranty status, and the loaner and spares stock." />
      {work ? <ActingFor work={work} what={`${work.scenario.accountOwner?.name ?? work.scenario.requester.name}'s equipment`} /> : <NoTicketNotice />}
      {work && (
        <section className="card">
          <div className="card-head">
            <h2>Stock actions</h2>
          </div>
          <ActionList items={items} session={work.session} onRun={(id) => work.emit({ type: 'action', actionId: id })} />
        </section>
      )}
      <section className="card">
        <div className="search wk-search">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Search by tag, person, model or hostname…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search assets" />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={SearchX} title="No assets match" />
        ) : (
          <div className="table-wrap">
            <table className="table wk-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Assigned to</th>
                  <th className="wk-hide-sm">Warranty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const expired = a.warrantyEnd !== '–' && a.warrantyEnd < today;
                  return (
                    <tr key={a.tag}>
                      <td>
                        <span className="mono">{a.tag}</span> {a.type}
                        <div className="small muted">
                          {a.model}
                          {a.hostname && (
                            <>
                              {' · '}
                              <Link to={`/devices/${a.hostname}`} className="mono">
                                {a.hostname}
                              </Link>
                            </>
                          )}
                        </div>
                        {works.some((w) => w.scenario.id === a.scenarioId) && <span className="pill pill-info wk-inline-pill">Your ticket</span>}
                      </td>
                      <td>{a.assignedTo}</td>
                      <td className={`wk-hide-sm num ${expired ? 'wk-expired' : ''}`}>{a.warrantyEnd === '–' ? '–' : `${a.warrantyEnd}${expired ? ' (expired)' : ''}`}</td>
                      <td>
                        <span className={`pill ${TONE[a.status]}`}>{a.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
