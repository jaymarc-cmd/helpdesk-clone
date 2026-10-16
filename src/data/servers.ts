import type { Scenario, ServerService, ServerState, ServerStatus } from '../types';

/**
 * Shared infrastructure at Harbor & Pine Logistics, shown in the Server room app.
 * Each ticket starts from this baseline; scenarios override individual servers (scenario.servers).
 */
export const SERVERS: ServerState[] = [
  {
    id: 'DC01',
    name: 'DC01',
    role: 'Domain controller',
    kind: 'server',
    ip: '10.20.0.4',
    location: 'HQ data room, rack A',
    status: 'Healthy',
    cpu: 14,
    memory: 41,
    uptime: '38 days',
    critical: true,
    services: [
      { name: 'Directory Services', status: 'Running' },
      { name: 'Kerberos Key Distribution', status: 'Running' },
    ],
  },
  {
    id: 'DNS01',
    name: 'DNS01',
    role: 'Internal DNS',
    kind: 'server',
    ip: '10.20.0.10',
    location: 'HQ data room, rack A',
    status: 'Healthy',
    cpu: 6,
    memory: 22,
    uptime: '38 days',
    critical: true,
    services: [{ name: 'DNS Server', status: 'Running' }],
  },
  {
    id: 'FS01',
    name: 'FS01',
    role: 'File server',
    kind: 'server',
    ip: '10.20.0.21',
    location: 'HQ data room, rack B',
    status: 'Healthy',
    cpu: 23,
    memory: 57,
    uptime: '12 days',
    critical: true,
    services: [{ name: 'File Sharing (SMB)', status: 'Running' }],
  },
  {
    id: 'PRINT01',
    name: 'PRINT01',
    role: 'Print server',
    kind: 'server',
    ip: '10.20.0.30',
    location: 'HQ data room, rack B',
    status: 'Healthy',
    cpu: 4,
    memory: 31,
    uptime: '6 days',
    services: [
      { name: 'Print Spooler', status: 'Running' },
      { name: 'Print Web Management', status: 'Running' },
    ],
  },
  {
    id: 'MAIL-GW01',
    name: 'MAIL-GW01',
    role: 'Mail relay',
    kind: 'server',
    ip: '10.20.0.40',
    location: 'HQ data room, rack C',
    status: 'Healthy',
    cpu: 18,
    memory: 48,
    uptime: '21 days',
    critical: true,
    services: [{ name: 'Mail Transport', status: 'Running' }],
  },
  {
    id: 'VPN-GW01',
    name: 'VPN-GW01',
    role: 'Remote access gateway',
    kind: 'server',
    ip: '203.0.113.40',
    location: 'Edge, rack C',
    status: 'Healthy',
    cpu: 27,
    memory: 39,
    uptime: '4 days',
    note: 'Certificate renewed at the weekend. Clients older than 5.1 can no longer connect.',
    critical: true,
    services: [{ name: 'Remote Access', status: 'Running' }],
  },
  {
    id: 'APP-TS02',
    name: 'APP-TS02',
    role: 'Timesheets portal',
    kind: 'server',
    ip: '10.10.8.45',
    location: 'HQ data room, rack D',
    status: 'Healthy',
    cpu: 11,
    memory: 36,
    uptime: '1 day',
    services: [{ name: 'Web Application', status: 'Running' }],
  },
  {
    id: 'SW-F3-EAST',
    name: 'SW-F3-EAST',
    role: 'Access switch, Floor 3 east (PoE)',
    kind: 'network',
    ip: '10.20.3.2',
    location: 'Floor 3 comms cupboard',
    status: 'Healthy',
    cpu: 9,
    memory: 18,
    uptime: '214 days',
    services: [],
  },
  {
    id: 'SW-F3-WEST',
    name: 'SW-F3-WEST',
    role: 'Access switch, Floor 3 west (PoE)',
    kind: 'network',
    ip: '10.20.3.3',
    location: 'Floor 3 comms cupboard',
    status: 'Healthy',
    cpu: 8,
    memory: 17,
    uptime: '214 days',
    services: [],
  },
];

export const SERVER_BY_ID: Record<string, ServerState> = Object.fromEntries(SERVERS.map((s) => [s.id, s]));

/** Server room state for a ticket: the baseline plus the scenario's overrides. */
export function serversFor(scenario: Scenario): ServerState[] {
  return SERVERS.map((base) => {
    const o = scenario.servers?.[base.id];
    return o ? { ...structuredClone(base), ...structuredClone(o) } : structuredClone(base);
  });
}

// ---------- Server operations as action ids ----------
// "srv:<server>:reboot" or "srv:<server>:restart:<service name>"

export type ServerOp = { server: string; op: 'reboot' } | { server: string; op: 'restart'; service: string };

export function serverActionId(op: ServerOp): string {
  return op.op === 'reboot' ? `srv:${op.server}:reboot` : `srv:${op.server}:restart:${op.service}`;
}

export function parseServerAction(id: string): ServerOp | null {
  const m = id.match(/^srv:([^:]+):(reboot|restart)(?::(.+))?$/);
  if (!m) return null;
  if (m[2] === 'reboot') return { server: m[1], op: 'reboot' };
  return m[3] ? { server: m[1], op: 'restart', service: m[3] } : null;
}

export function isKnownServerAction(id: string): boolean {
  const op = parseServerAction(id);
  if (!op) return false;
  const srv = SERVER_BY_ID[op.server];
  if (!srv) return false;
  return op.op === 'reboot' || srv.services.some((s) => s.name === op.service);
}

export function serverActionLabel(op: ServerOp): string {
  return op.op === 'reboot' ? `Reboot ${op.server}` : `Restart ${op.service} on ${op.server}`;
}

/** Disruptive by nature: rebooting a core server takes it away from the whole company. */
export function isDisruptiveServerAction(id: string): boolean {
  const op = parseServerAction(id);
  return !!op && op.op === 'reboot' && !!SERVER_BY_ID[op.server]?.critical;
}

export function computeStatus(server: ServerState): ServerStatus {
  if (server.status === 'Unreachable' || server.status === 'Down') return server.status;
  return server.services.every((s) => s.status === 'Running') ? 'Healthy' : 'Degraded';
}

/** Applies a server operation to the ticket's server list. Returns the new list and a default result text. */
export function applyServerOp(servers: ServerState[], op: ServerOp): { servers: ServerState[]; result: string } {
  const target = servers.find((s) => s.id === op.server);
  if (!target) return { servers, result: `${op.server} was not found.` };
  if (target.status === 'Unreachable' || target.status === 'Down') {
    return {
      servers,
      result: `Command failed: ${target.id} is not responding on the management network. It needs hands-on attention from the team that owns it.`,
    };
  }
  const services: ServerService[] =
    op.op === 'reboot'
      ? target.services.map((s) => ({ ...s, status: 'Running' }))
      : target.services.map((s) => (s.name === op.service ? { ...s, status: 'Running' } : s));
  const was = target.services.find((s) => op.op === 'restart' && s.name === op.service)?.status;
  const updated: ServerState = { ...target, services, uptime: op.op === 'reboot' ? 'Just now' : target.uptime };
  updated.status = computeStatus(updated);
  const result =
    op.op === 'reboot'
      ? `${target.id} rebooted and came back after about 4 minutes. All services are running.${
          target.critical ? ` While it restarted, everyone lost ${target.role.toLowerCase()} services.` : ''
        }`
      : was && was !== 'Running'
        ? `${op.service} started on ${target.id} and is now running.`
        : `${op.service} on ${target.id} was already running. It restarted without any change.`;
  return { servers: servers.map((s) => (s.id === target.id ? updated : s)), result };
}
