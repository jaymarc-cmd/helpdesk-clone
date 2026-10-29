import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, Network, Power, RotateCcw, Server, ShieldAlert, TriangleAlert } from 'lucide-react';
import { SERVERS, serverActionId } from '../data/servers';
import { useStore } from '../state/store';
import type { ServerState } from '../types';
import { PageHeader, ProgressBar } from '../components/ui';
import { ActingFor, ActionList, NoTicketNotice } from '../components/work';
import '../styles/workspace.css';
import '../styles/workstation.css';

const STATUS_TONE: Record<ServerState['status'], string> = {
  Healthy: 'pill-success',
  Degraded: 'pill-warning',
  Down: 'pill-danger',
  Unreachable: 'pill-danger',
};

export function ServerRoom() {
  const { work } = useStore();
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const servers = work ? work.session.servers : SERVERS;

  useEffect(() => {
    if (work) work.emit({ type: 'openTool', tool: 'servers' });
    // Only the first visit per ticket matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!work]);

  const attention = servers.filter((s) => s.status !== 'Healthy');
  const list = filter === 'attention' ? attention : servers;

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        title="Server room"
        description="Live status of shared servers and network gear. Restart a stopped service, or reboot when nothing else helps."
        actions={
          <div className="seg" role="group" aria-label="Filter">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All <span className="num">{servers.length}</span>
            </button>
            <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>
              Needs attention <span className="num">{attention.length}</span>
            </button>
          </div>
        }
      />

      {work ? <ActingFor work={work} what="shared infrastructure" /> : <NoTicketNotice />}

      {list.length === 0 ? (
        <div className="card">
          <p className="ws-empty-hint">Everything is healthy.</p>
        </div>
      ) : (
        <div className="wk-servers">
          {list.map((srv) => (
            <ServerCard key={srv.id} srv={srv} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerCard({ srv }: { srv: ServerState }) {
  const { work } = useStore();
  const Icon = srv.kind === 'network' ? Network : Server;
  const items = [
    ...srv.services.map((svc) => ({
      id: serverActionId({ server: srv.id, op: 'restart', service: svc.name }),
      label: `Restart ${svc.name}`,
      description: `Restarts only this service on ${srv.id}.`,
    })),
    {
      id: serverActionId({ server: srv.id, op: 'reboot' }),
      label: `Reboot ${srv.id}`,
      description: srv.critical ? `Takes ${srv.role.toLowerCase()} offline for everyone for several minutes.` : 'Restarts the whole machine (a few minutes of downtime).',
      destructive: true,
    },
  ];
  return (
    <section className={`card wk-server ${srv.status !== 'Healthy' ? 'attention' : ''}`} aria-label={srv.id}>
      <div className="card-head">
        <h2 className="srv-name">
          <Icon size={16} aria-label={srv.kind === 'network' ? 'Network switch' : 'Server'} />
          <span className="mono">{srv.id}</span>
        </h2>
        <span className="row wk-server-pills">
          {srv.critical && (
            <span className="pill pill-outline" title="Core service: many users depend on it">
              <ShieldAlert aria-hidden />
              Core
            </span>
          )}
          <span className={`pill ${STATUS_TONE[srv.status]}`}>{srv.status}</span>
        </span>
      </div>
      <p className="card-sub wk-server-sub">
        <span>{srv.role}</span>
        <span>
          <span className="mono">{srv.ip}</span> · {srv.location}
        </span>
      </p>
      {srv.note && (
        <div className={`callout small ${srv.status === 'Healthy' ? '' : 'warning'}`}>
          <TriangleAlert size={16} aria-hidden />
          <div className="callout-body">{srv.note}</div>
        </div>
      )}
      <div className="wk-metrics">
        <div>
          <span className="label inline-icon">
            <Cpu size={12} aria-hidden /> CPU
          </span>
          <ProgressBar value={srv.cpu / 100} tone={srv.cpu > 85 ? 'danger' : undefined} />
        </div>
        <div>
          <span className="label inline-icon">
            <MemoryStick size={12} aria-hidden /> Memory
          </span>
          <ProgressBar value={srv.memory / 100} tone={srv.memory > 85 ? 'danger' : undefined} />
        </div>
        <div className="wk-uptime">
          <span className="label inline-icon">
            <Power size={12} aria-hidden /> Uptime
          </span>
          <span className="num small">{srv.uptime}</span>
        </div>
      </div>
      {srv.services.length > 0 && (
        <ul className="wk-services">
          {srv.services.map((svc) => (
            <li key={svc.name}>
              <span className={`status-dot ${svc.status === 'Running' ? 'ok' : 'bad'}`} aria-hidden />
              <span>{svc.name}</span>
              <span className={`pill ${svc.status === 'Running' ? 'pill-success' : 'pill-danger'}`}>{svc.status}</span>
            </li>
          ))}
        </ul>
      )}
      <details className="wk-server-actions">
        <summary>
          <RotateCcw size={14} aria-hidden />
          Actions
        </summary>
        <ActionList items={items} session={work?.session ?? null} onRun={(id) => work?.emit({ type: 'action', actionId: id })} disabled={!work} />
      </details>
    </section>
  );
}
