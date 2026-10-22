import { useEffect, useMemo, useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { allApprovals } from '../data/approvals';
import { useStore } from '../state/store';
import { EmptyState, PageHeader } from '../components/ui';
import '../styles/workspace.css';
import '../styles/workstation.css';

const TONE = { Approved: 'success', Pending: 'warning', Rejected: 'danger' } as const;

/** Approval records: access, software and mailbox requests and who signed them off. */
export function ApprovalsPage() {
  const { scenarios, works } = useStore();
  const rows = useMemo(() => allApprovals(scenarios), [scenarios]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'Approved' | 'Pending' | 'Rejected'>('all');
  const list = rows.filter(
    (r) => (status === 'all' || r.status === status) && (!q || `${r.id} ${r.item} ${r.requestedFor} ${r.approver}`.toLowerCase().includes(q.toLowerCase())),
  );

  // Checking the approvals counts as evidence on any open ticket that has records here.
  useEffect(() => {
    for (const w of works) if (w.scenario.approvals?.length) w.emit({ type: 'openTool', tool: 'approvals' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page ws-root wk-app">
      <PageHeader title="Approvals" description="Access, mailbox and software requests, and who approved them. Check here before granting anything that needs sign-off." />
      <section className="card">
        <div className="wk-filter-row">
          <div className="search wk-search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Search by person, item or approver…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search approvals" />
          </div>
          <div className="seg" role="group" aria-label="Status">
            {(['all', 'Approved', 'Pending', 'Rejected'] as const).map((s) => (
              <button key={s} type="button" className={status === s ? 'active' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={SearchX} title="No approvals match" />
        ) : (
          <div className="table-wrap">
            <table className="table wk-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>For</th>
                  <th className="wk-hide-sm">Approver</th>
                  <th>Status</th>
                  <th className="wk-hide-sm">When</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="mono">{r.id}</span> {r.item}
                      {r.note && <div className="small muted">{r.note}</div>}
                      {works.some((w) => w.scenario.id === r.scenarioId) && <span className="pill pill-info wk-inline-pill">Your ticket</span>}
                    </td>
                    <td>{r.requestedFor}</td>
                    <td className="wk-hide-sm">{r.approver}</td>
                    <td>
                      <span className={`pill pill-${TONE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="wk-hide-sm muted">{r.daysAgo === 0 ? 'Today' : r.daysAgo === 1 ? 'Yesterday' : `${r.daysAgo} days ago`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
