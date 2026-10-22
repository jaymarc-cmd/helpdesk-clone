import type { ApprovalRecord, Scenario } from '../types';

/** Approvals that already exist in the system, unrelated to any ticket. */
const STANDING: ApprovalRecord[] = [
  { id: 'APR-3122', item: 'Software: Visio Professional', requestedFor: 'Chloe Martin', approver: 'Digital Lead', status: 'Approved', daysAgo: 9 },
  { id: 'APR-3140', item: 'Group: HR-Payroll-RO', requestedFor: 'Hannah Brooks', approver: 'Payroll Manager', status: 'Approved', daysAgo: 6 },
  { id: 'APR-3151', item: 'Mailbox: board-papers@ (Read)', requestedFor: 'Daniel Kim', approver: 'Office of the CEO', status: 'Rejected', daysAgo: 4, note: 'Not required for the role.' },
  { id: 'APR-3166', item: 'Local admin rights (24 h)', requestedFor: 'Marcus Hill', approver: 'IT Security', status: 'Rejected', daysAgo: 3, note: 'Use Software Center instead.' },
  { id: 'APR-3179', item: 'Second monitor', requestedFor: 'Aisha Kamara', approver: 'Finance Manager', status: 'Pending', daysAgo: 1 },
];

export interface ApprovalRow extends ApprovalRecord {
  scenarioId?: string;
}

export function allApprovals(scenarios: Scenario[]): ApprovalRow[] {
  const fromTickets = scenarios.flatMap((sc) => (sc.approvals ?? []).map((a) => ({ ...a, scenarioId: sc.id })));
  return [...fromTickets, ...STANDING].sort((a, b) => a.daysAgo - b.daysAgo || a.id.localeCompare(b.id));
}
