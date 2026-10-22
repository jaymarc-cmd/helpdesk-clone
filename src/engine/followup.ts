import type { Scenario, TicketAttempt } from '../types';
import { allRequirementsMet, type SessionState } from './session';

/** Real minutes before a resolution that did not hold comes back. */
export const REOPEN_AFTER_MS = 3 * 60_000;

/** Why a resolution will not hold, or undefined if it will. Reopened tickets do not reopen again. */
export function reopenReason(sc: Scenario, s: SessionState, outcome: TicketAttempt['submission']['outcome'], rootCause: string): string | undefined {
  if (s.reopenOf || sc.correctOutcome !== 'resolve' || outcome !== 'resolve') return undefined;
  if (!allRequirementsMet(sc, s.actions)) return 'The fix was never actually applied, so the problem is still there.';
  if (rootCause !== sc.correctRootCause) return 'The recorded cause was wrong, so the real one comes back.';
  if (!s.confirmed) return 'Nobody checked the fix with the user, and they say it is still not right.';
  return undefined;
}

export interface Handoff {
  verdict: 'accepted' | 'returned' | 'reassigned';
  team: string;
  message: string;
}

/** How the receiving team responds to an escalation. */
export function handoffVerdict(sc: Scenario, attempt: TicketAttempt): Handoff | undefined {
  const sub = attempt.submission;
  if (sub.outcome !== 'escalate' || !sub.team) return undefined;
  if (sc.correctOutcome !== 'escalate') {
    return {
      verdict: 'returned',
      team: sub.team,
      message: `Returned by ${sub.team}: "This is something the service desk can fix at tier 1. Sending it back to you."`,
    };
  }
  if (sc.escalateTo && sub.team !== sc.escalateTo) {
    return {
      verdict: 'reassigned',
      team: sub.team,
      message: `${sub.team} reassigned it to ${sc.escalateTo}: "Not ours. ${sc.escalateTo} owns this." The requester waited longer while it bounced.`,
    };
  }
  const doc = attempt.result.sections.find((x) => x.key === 'documentation');
  if (doc && doc.score < doc.max * 0.7) {
    return {
      verdict: 'returned',
      team: sub.team,
      message: `Returned by ${sub.team}: "Please add what you checked, what you found and what you already tried, so we don't start from scratch."`,
    };
  }
  return { verdict: 'accepted', team: sub.team, message: `Accepted by ${sub.team}: "Thanks, clear hand-off. We'll take it from here and update the user."` };
}
