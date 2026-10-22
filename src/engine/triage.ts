import type { Category, Level, Priority, Scenario } from '../types';

/** Impact x urgency priority matrix (rows: impact, columns: urgency). */
const MATRIX: Record<Level, Record<Level, Priority>> = {
  High: { High: 'P1', Medium: 'P2', Low: 'P3' },
  Medium: { High: 'P2', Medium: 'P3', Low: 'P4' },
  Low: { High: 'P3', Medium: 'P4', Low: 'P4' },
};

export function priorityFor(impact: Level, urgency: Level): Priority {
  return MATRIX[impact][urgency];
}

/** What the queue shows before anyone has triaged the ticket. */
export function loggedPriority(sc: Scenario): Priority {
  return sc.reportedPriority ?? sc.priority;
}

export interface Triage {
  category?: Category;
  impact?: Level;
  urgency?: Level;
}

export function triagedPriority(t: Triage | undefined): Priority | undefined {
  return t?.impact && t.urgency ? priorityFor(t.impact, t.urgency) : undefined;
}

/** The priority to show for a ticket in progress: triaged if set, otherwise as logged. */
export function currentPriority(sc: Scenario, t: Triage | undefined): Priority {
  return triagedPriority(t) ?? loggedPriority(sc);
}

export const IMPACT_HELP: Record<Level, string> = {
  High: 'A whole site, team or business-critical service',
  Medium: 'Several people, or one person in a key role',
  Low: 'One person, with a workaround',
};
export const URGENCY_HELP: Record<Level, string> = {
  High: 'Work has stopped, or there is a security risk now',
  Medium: 'Work is badly slowed down',
  Low: 'Inconvenient, can wait',
};
