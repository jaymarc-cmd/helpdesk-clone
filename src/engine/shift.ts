import type { ActiveShift, Priority, Scenario, ShiftReport, TicketAttempt } from '../types';
import { loggedPriority } from './triage';

/** Minutes until a shift ticket breaches SLA, by priority. */
export const SHIFT_SLA_MIN: Record<Priority, number> = { P1: 8, P2: 12, P3: 16, P4: 20 };

function shuffle<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createShift(pool: Scenario[], durationMin: number, now = Date.now(), rnd: () => number = Math.random): ActiveShift {
  const count = Math.min(pool.length, Math.max(4, Math.round(durationMin / 3.5)));
  const picked = shuffle(pool, rnd).slice(0, count).map((s) => s.id);
  const initial = Math.min(2, picked.length);
  return {
    startedAt: now,
    durationMin,
    tickets: picked.slice(0, initial).map((id) => ({ scenarioId: id, arrivedAt: now, status: 'waiting' })),
    pending: picked.slice(initial),
    nextArrivalAt: now + arrivalGap(durationMin, count - initial),
  };
}

function arrivalGap(durationMin: number, remaining: number): number {
  if (remaining <= 0) return Number.POSITIVE_INFINITY;
  // Spread arrivals over the first ~70% of the shift.
  return Math.max(45_000, (durationMin * 60_000 * 0.7) / (remaining + 1));
}

/** Delivers due tickets. Returns the same object when nothing changed. */
export function tickShift(shift: ActiveShift, now = Date.now()): ActiveShift {
  if (!shift.pending.length || now < shift.nextArrivalAt) return shift;
  const [next, ...rest] = shift.pending;
  return {
    ...shift,
    tickets: [...shift.tickets, { scenarioId: next, arrivedAt: now, status: 'waiting' }],
    pending: rest,
    nextArrivalAt: now + arrivalGap(shift.durationMin, rest.length),
  };
}

export function shiftEndsAt(shift: ActiveShift): number {
  return shift.startedAt + shift.durationMin * 60_000;
}

export function slaDeadline(arrivedAt: number, priority: Priority): number {
  return arrivedAt + SHIFT_SLA_MIN[priority] * 60_000;
}

export function completeShiftTicket(shift: ActiveShift, scenario: Scenario, attempt: TicketAttempt, now = Date.now()): ActiveShift {
  return {
    ...shift,
    tickets: shift.tickets.map((t) =>
      t.scenarioId === scenario.id && t.status === 'waiting'
        ? { ...t, status: 'done', attemptId: attempt.id, slaBreached: now > slaDeadline(t.arrivedAt, loggedPriority(scenario)) }
        : t,
    ),
  };
}

export function buildShiftReport(
  shift: ActiveShift,
  attempts: TicketAttempt[],
  findScenario: (id: string) => Scenario | undefined,
  now = Date.now(),
): ShiftReport {
  const done = shift.tickets.filter((t) => t.status === 'done');
  const waiting = shift.tickets.filter((t) => t.status === 'waiting');
  const doneAttempts = done.map((t) => attempts.find((a) => a.id === t.attemptId)).filter(Boolean) as TicketAttempt[];
  const breachedWaiting = waiting.filter((t) => {
    const sc = findScenario(t.scenarioId);
    return sc ? now > slaDeadline(t.arrivedAt, loggedPriority(sc)) : false;
  });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    id: `shift-${now}`,
    completedAt: new Date(now).toISOString(),
    durationMin: shift.durationMin,
    handled: done.length,
    missed: waiting.length + shift.pending.length,
    breaches: done.filter((t) => t.slaBreached).length + breachedWaiting.length,
    avgScore: Math.round(avg(doneAttempts.map((a) => a.result.total))),
    avgCsat: Math.round(avg(doneAttempts.map((a) => a.result.csat)) * 10) / 10,
  };
}
