import type { AccountState, DeviceState, Requester, Scenario } from '../../types';

/** Fictional company used throughout the simulator. */
export const COMPANY = {
  name: 'Harbor & Pine Logistics',
  domain: 'hpl.example',
};

export function person(
  name: string,
  title: string,
  department: string,
  location: string,
  extra: Partial<Requester> = {},
): Requester {
  const [first, ...rest] = name.toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/);
  const last = rest.join('');
  const ext = String(2000 + ((name.length * 137) % 7000));
  return {
    name,
    title,
    department,
    location,
    email: `${first}.${last}@${COMPANY.domain}`,
    phone: `ext. ${ext}`,
    ...extra,
  };
}

export function account(username: string, overrides: Partial<AccountState> = {}): AccountState {
  return {
    username,
    status: 'Active',
    passwordLastSet: '34 days ago',
    passwordExpired: false,
    mfa: 'Enrolled (Authenticator app)',
    lastLogon: 'Today 08:12',
    failedLogons: 0,
    groups: ['All Staff', 'VPN Users'],
    mailboxUsage: '18.4 GB of 50 GB',
    archive: 'Enabled',
    activeSessions: 3,
    ...overrides,
  };
}

export function device(hostname: string, overrides: Partial<DeviceState> = {}): DeviceState {
  const n = parseInt(hostname.replace(/\D/g, '').slice(-3) || '50', 10) % 250;
  return {
    hostname,
    model: 'Standard Laptop L14 (Gen 3)',
    os: 'Windows 11 Enterprise 24H2',
    ip: `10.20.4.${n + 2}`,
    gateway: '10.20.4.1',
    dns: '10.20.0.10',
    online: true,
    diskFree: '142 GB of 238 GB',
    uptime: '2 days',
    lastPatch: '6 days ago',
    installedNotes: ['Endpoint protection: healthy', 'VPN Client 5.1.3'],
    ...overrides,
  };
}

type ScenarioInput = Omit<Scenario, 'identity'> & { identity?: Scenario['identity'] };

export function scenario(input: ScenarioInput): Scenario {
  return {
    identity: {
      verifiable: true,
      reply: 'Sure, go ahead and verify me.',
    },
    ...input,
  };
}
