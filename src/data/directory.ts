import { account } from './scenarios/base';
import type { AccountState, Scenario } from '../types';

export interface DirectoryPerson {
  username: string;
  name: string;
  title: string;
  department: string;
  location: string;
  email: string;
  phone: string;
  account: AccountState;
  /** Scenario whose ticket this person belongs to, if any. */
  scenarioId?: string;
}

/** Groups that grant broad or privileged access. Adding someone to these without a request is a serious mistake. */
export const PRIVILEGED_GROUPS = ['Domain Admins', 'Finance - Admin', 'Executives', 'Helpdesk Operators'];

/** Every security group in the directory, for the Groups tab picker. */
export const ALL_GROUPS = [
  'All Staff',
  'VPN Users',
  'Finance - Read',
  'FIN-Reports-RW',
  'Finance - Admin',
  'HR - Confidential',
  'Sales - CRM',
  'Marketing - Shared',
  'Operations - Dispatch',
  'Digital - Design',
  'Remote Desktop Users',
  'Executives',
  'Helpdesk Operators',
  'Domain Admins',
];

/** Staff who are not part of any ticket, so the directory feels like a real company. */
const FILLER: Omit<DirectoryPerson, 'account'>[] = [
  { username: 'priya.raman', name: 'Priya Raman', title: 'Accounts Payable Lead', department: 'Finance', location: 'HQ, Floor 2', email: 'priya.raman@hpl.example', phone: 'ext. 2214' },
  { username: 'kofi.mensah', name: 'Kofi Mensah', title: 'Warehouse Manager', department: 'Operations', location: 'Warehouse B', email: 'kofi.mensah@hpl.example', phone: 'ext. 4730' },
  { username: 'luis.fernandez', name: 'Luis Fernández', title: 'Head of People', department: 'People & Culture', location: 'HQ, Floor 4', email: 'luis.fernandez@hpl.example', phone: 'ext. 4102' },
  { username: 'rosa.delgado', name: 'Rosa Delgado', title: 'Procurement Manager', department: 'Procurement', location: 'HQ, Floor 3', email: 'rosa.delgado@hpl.example', phone: 'ext. 3307' },
  { username: 'jun.park', name: 'Jun Park', title: 'Payroll Officer', department: 'Finance', location: 'HQ, Floor 2', email: 'jun.park@hpl.example', phone: 'ext. 2290' },
  { username: 'sophie.lambert', name: 'Sophie Lambert', title: 'Account Manager', department: 'Sales', location: 'Leeds branch office', email: 'sophie.lambert@hpl.example', phone: 'ext. 6120' },
  { username: 'mike.harrow', name: 'Mike Harrow', title: 'Senior Accountant', department: 'Finance', location: 'Remote (home office)', email: 'mike.harrow@hpl.example', phone: 'ext. 2241' },
  { username: 'noor.haddad', name: 'Noor Haddad', title: 'Service Desk Analyst', department: 'IT', location: 'HQ, Floor 1', email: 'noor.haddad@hpl.example', phone: 'ext. 1004' },
  { username: 'victor.hale', name: 'Victor Hale', title: 'Commercial Director', department: 'Commercial', location: 'HQ, Floor 6', email: 'victor.hale@hpl.example', phone: 'ext. 6001' },
  { username: 'tess.okoro', name: 'Tess Okoro', title: 'Dispatch Planner', department: 'Operations', location: 'HQ, Floor 3', email: 'tess.okoro@hpl.example', phone: 'ext. 3388' },
];

function titleCaseUsername(username: string): string {
  return username
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Everyone in the directory: each ticket's account owner plus the rest of the company. */
export function directoryPeople(scenarios: Scenario[]): DirectoryPerson[] {
  const people = new Map<string, DirectoryPerson>();
  for (const sc of scenarios) {
    const username = sc.account.username;
    if (people.has(username)) continue;
    const isRequester = sc.requester.email.split('@')[0] === username;
    const owner = sc.accountOwner ?? (isRequester ? sc.requester : undefined);
    people.set(username, {
      username,
      name: owner?.name ?? titleCaseUsername(username),
      title: owner?.title ?? 'Employee',
      department: owner?.department ?? sc.requester.department,
      location: isRequester ? sc.requester.location : 'HQ',
      email: `${username}@hpl.example`,
      phone: isRequester ? sc.requester.phone : 'ext. 1000',
      account: sc.account,
      scenarioId: sc.id,
    });
  }
  for (const f of FILLER) {
    if (!people.has(f.username)) people.set(f.username, { ...f, account: account(f.username, { lastLogon: 'Today 08:40' }) });
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}
