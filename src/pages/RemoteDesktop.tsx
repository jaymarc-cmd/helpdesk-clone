import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleDot, Laptop, ListChecks, MonitorSmartphone, Search, SearchX, SquareTerminal, Wrench, type LucideIcon } from 'lucide-react';
import { actionsForTool } from '../data/actions';
import { directoryPeople } from '../data/directory';
import { useStore } from '../state/store';
import type { DeviceState } from '../types';
import { EmptyState, PageHeader } from '../components/ui';
import { ActingFor, ActionList, NoTicketNotice, TerminalPane } from '../components/work';
import '../styles/workspace.css';
import '../styles/workstation.css';

interface DeviceRow {
  device: DeviceState;
  user: string;
  username: string;
}

/** Disruptive endpoint actions ask for confirmation first. */
const DESTRUCTIVE = new Set(['reimage', 'remote_restart', 'isolate_device', 'repair_office']);

function useDevices(): DeviceRow[] {
  const { scenarios, work } = useStore();
  return useMemo(() => {
    const people = new Map(directoryPeople(scenarios).map((p) => [p.username, p.name]));
    const rows = new Map<string, DeviceRow>();
    for (const sc of scenarios) {
      if (rows.has(sc.device.hostname)) continue;
      rows.set(sc.device.hostname, {
        device: work?.scenario.device.hostname === sc.device.hostname ? work.session.device : sc.device,
        user: people.get(sc.account.username) ?? sc.requester.name,
        username: sc.account.username,
      });
    }
    return [...rows.values()].sort((a, b) => a.device.hostname.localeCompare(b.device.hostname));
  }, [scenarios, work]);
}

function OnlinePill({ d }: { d: DeviceState }) {
  const powered = !(d.ip === '' && !d.online);
  return (
    <span className={`pill ${d.online ? 'pill-success' : 'pill-danger'}`}>
      <span className={`status-dot ${d.online ? 'ok' : 'bad'}`} aria-hidden />
      {d.online ? 'Online' : powered ? 'Not reachable' : 'Offline'}
    </span>
  );
}

export function RemoteDesktop() {
  const { hostname } = useParams();
  return hostname ? <DevicePage key={hostname} hostname={hostname} /> : <DeviceList />;
}

function DeviceList() {
  const rows = useDevices();
  const { work } = useStore();
  const [q, setQ] = useState('');
  const list = rows.filter((r) => !q || `${r.device.hostname} ${r.user} ${r.username} ${r.device.model}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page ws-root wk-app">
      <PageHeader
        eyebrow={
          <>
            <MonitorSmartphone size={14} aria-hidden />
            <span>Workstation</span>
          </>
        }
        title="Remote desktop"
        description="Managed laptops and desktops. Connect to see health and inventory, run remote actions or open a PowerShell session."
      />
      <section className="card">
        <div className="search wk-search">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Search by hostname or user…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search devices" />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={SearchX} title="No devices match">
            Hostnames look like HPL-LT-1234 (laptops) or HPL-DT-0123 (desktops).
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table wk-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>User</th>
                  <th className="wk-hide-sm">Model</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.device.hostname}>
                    <td>
                      <Link to={`/devices/${r.device.hostname}`} className="wk-person">
                        <Laptop size={16} aria-hidden />
                        <span className="mono">{r.device.hostname}</span>
                      </Link>
                      {work?.scenario.device.hostname === r.device.hostname && <span className="pill pill-info wk-inline-pill">Your ticket</span>}
                    </td>
                    <td>{r.user}</td>
                    <td className="wk-hide-sm">{r.device.model}</td>
                    <td>
                      <OnlinePill d={r.device} />
                    </td>
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

type Tab = 'overview' | 'actions' | 'terminal';
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: ListChecks },
  { id: 'actions', label: 'Remote actions', icon: Wrench },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
];

function DevicePage({ hostname }: { hostname: string }) {
  const rows = useDevices();
  const { work } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const row = rows.find((r) => r.device.hostname === hostname);
  const editable = !!work && work.scenario.device.hostname === hostname;

  useEffect(() => {
    if (editable) work.emit({ type: 'openTool', tool: 'endpoint' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  if (!row) {
    return (
      <div className="page ws-root wk-app">
        <PageHeader back={{ to: '/devices', label: 'Remote desktop' }} title="Device not found" />
        <div className="card">
          <EmptyState icon={SearchX} title={`No managed device called ${hostname}`}>
            <Link className="btn btn-sm" to="/devices">
              All devices
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }
  const d = row.device;
  const items = actionsForTool('endpoint').map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    sensitive: a.sensitive,
    destructive: DESTRUCTIVE.has(a.id),
  }));

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        back={{ to: '/devices', label: 'Remote desktop' }}
        eyebrow={
          <>
            <MonitorSmartphone size={14} aria-hidden />
            <span>Remote desktop · {row.user}</span>
          </>
        }
        title={<span className="mono">{d.hostname}</span>}
        meta={
          <>
            <OnlinePill d={d} />
            <span className="pill">{d.model}</span>
            <span className="inline-icon">{d.os}</span>
            {editable && <span className="pill pill-info">Your open ticket</span>}
          </>
        }
      />

      {editable ? (
        <ActingFor work={work} what={`device ${d.hostname}`} />
      ) : (
        <NoTicketNotice>
          <strong>Read-only.</strong>{' '}
          {work ? (
            <>
              Your open ticket is for <Link to={`/devices/${work.scenario.device.hostname}`}>{work.scenario.device.hostname}</Link>. Connecting to other
              people's devices needs their own ticket.
            </>
          ) : (
            <>
              Remote sessions are recorded against a ticket. Assign yourself one in the <Link to="/tickets">ticket queue</Link> first.
            </>
          )}
        </NoTicketNotice>
      )}

      <section className="card wk-tabs-card">
        <div className="tabs" role="tablist" aria-label="Device sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="wk-tab-body">
          {tab === 'overview' && (
            <div className="stack">
              <dl className="kv wk-kv">
                <dt>Signed-in user</dt>
                <dd className="mono">{row.username}</dd>
                <dt>IP address</dt>
                <dd className="mono">{d.ip || '–'}</dd>
                <dt>Disk free</dt>
                <dd>{d.diskFree}</dd>
                <dt>Uptime</dt>
                <dd>{d.uptime}</dd>
                <dt>Last patch</dt>
                <dd>{d.lastPatch}</dd>
              </dl>
              {d.installedNotes && d.installedNotes.length > 0 && (
                <div>
                  <div className="label ws-label-row">
                    <ListChecks size={14} aria-hidden />
                    Inventory and health
                  </div>
                  <ul className="ws-inventory">
                    {d.installedNotes.map((n) => (
                      <li key={n}>
                        <CircleDot size={12} aria-hidden />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {tab === 'actions' && (
            <ActionList items={items} session={editable ? work.session : null} onRun={(id) => work?.emit({ type: 'action', actionId: id })} disabled={!editable} />
          )}
          {tab === 'terminal' &&
            (editable ? (
              <TerminalPane work={work} />
            ) : (
              <p className="ws-empty-hint">A remote PowerShell session needs an open ticket for this device.</p>
            ))}
        </div>
      </section>
    </div>
  );
}
