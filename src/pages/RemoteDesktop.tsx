import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Laptop, MonitorSmartphone, RotateCcw, Search, SearchX, SquareTerminal } from 'lucide-react';
import { directoryPeople } from '../data/directory';
import { useStore, type Work } from '../state/store';
import type { DeviceState } from '../types';
import { EmptyState, PageHeader } from '../components/ui';
import { ActingFor, NoTicketNotice, TerminalPane } from '../components/work';
import { Desktop } from '../components/desktop/Desktop';
import '../styles/workspace.css';
import '../styles/workstation.css';

interface DeviceRow {
  device: DeviceState;
  user: string;
  username: string;
}

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

function DevicePage({ hostname }: { hostname: string }) {
  const rows = useDevices();
  const { work } = useStore();
  const row = rows.find((r) => r.device.hostname === hostname);
  const editable = !!work && work.scenario.device.hostname === hostname;

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

  return (
    <div className="page ws-root wk-app">
      <PageHeader
        back={{ to: '/devices', label: 'Remote desktop' }}
        title={<span className="mono">{d.hostname}</span>}
        meta={
          <>
            <OnlinePill d={d} />
            <span className="pill">{d.model}</span>
            <span className="inline-icon">{d.os}</span>
            <span className="inline-icon">Assigned to {row.user}</span>
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

      {editable ? (
        <RemoteSession work={work} />
      ) : (
        <section className="card">
          <div className="dt-connect">
            <span className="dt-tile tone-slate">
              <MonitorSmartphone size={28} aria-hidden />
            </span>
            <h2>Remote session unavailable</h2>
            <p>Connecting to {d.hostname} needs an open ticket for this device.</p>
          </div>
        </section>
      )}
    </div>
  );
}

/** Connect screen, then the simulated desktop. Offline devices fall back to a relayed PowerShell session. */
function RemoteSession({ work }: { work: Work }) {
  const d = work.session.device;
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'relay'>('idle');
  const poweredOff = !d.online && d.ip === '';

  const connect = () => {
    setPhase('connecting');
    work.emit({ type: 'openTool', tool: 'endpoint' });
    setTimeout(() => setPhase(d.online ? 'connected' : 'failed'), 900);
  };

  if (phase === 'connected') return <Desktop work={work} onDisconnect={() => setPhase('idle')} />;

  if (phase === 'relay')
    return (
      <section className="card ws-root">
        <div className="card-head">
          <h2>
            Relayed PowerShell
          </h2>
          <button className="btn btn-sm" onClick={() => setPhase('idle')}>
            End session
          </button>
        </div>
        <TerminalPane work={work} />
      </section>
    );

  return (
    <section className="card">
      <div className="dt-connect">
        <span className="dt-tile tone-teal">
          <MonitorSmartphone size={28} aria-hidden />
        </span>
        {phase === 'connecting' ? (
          <>
            <h2>Connecting to {d.hostname}</h2>
            <span className="dt-connecting" aria-label="Connecting">
              <i />
              <i />
              <i />
            </span>
          </>
        ) : phase === 'failed' ? (
          <>
            <h2>Couldn't connect to {d.hostname}</h2>
            <p>
              {poweredOff
                ? 'The device is powered off or has no network connection, so a remote session is not possible.'
                : 'The device is not reachable on the network. You can still ask the user to run commands and read you the results.'}
            </p>
            <div className="row">
              <button className="btn" onClick={connect}>
                <RotateCcw size={16} aria-hidden />
                Try again
              </button>
              {!poweredOff && (
                <button className="btn btn-primary" onClick={() => setPhase('relay')}>
                  <SquareTerminal size={16} aria-hidden />
                  Relayed PowerShell
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2>Remote desktop to {d.hostname}</h2>
            <p>
              Take control of {work.scenario.accountOwner?.name ?? work.scenario.requester.name}'s {d.model.toLowerCase()} to check settings, run updates, clear queues or open
              PowerShell. Everything you do is recorded on the ticket.
            </p>
            <button className="btn btn-primary btn-lg" onClick={connect}>
              <MonitorSmartphone size={16} aria-hidden />
              Connect
            </button>
          </>
        )}
      </div>
    </section>
  );
}
