import { CATEGORIES, type Category, type Difficulty, type Scenario, type TicketAttempt } from '../types';
import { allRequirementsMet, type SessionState } from './session';
import { triagedPriority } from './triage';

// ---------- Adaptive recommendation ----------

/** Difficulty to aim for next: step up after strong recent tickets, down after weak ones. */
export function targetDifficulty(tickets: TicketAttempt[]): Difficulty {
  const recent = tickets.slice(-3);
  if (!recent.length) return 1;
  const avg = recent.reduce((n, t) => n + t.result.total, 0) / recent.length;
  const last = recent[recent.length - 1].difficulty;
  const next = avg >= 85 ? last + 1 : avg < 60 ? last - 1 : last;
  return Math.max(1, Math.min(3, next)) as Difficulty;
}

/** An unpassed ticket in the weakest category, as close as possible to the target difficulty. */
export function recommendTicket(
  scenarios: Scenario[],
  best: Record<string, number>,
  weakest: Category,
  tickets: TicketAttempt[],
): Scenario | undefined {
  const target = targetDifficulty(tickets);
  const open = scenarios.filter((s) => (best[s.id] ?? 0) < 70);
  const byFit = (a: Scenario, b: Scenario) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) || a.difficulty - b.difficulty;
  return [...open.filter((s) => s.category === weakest)].sort(byFit)[0] ?? [...open].sort(byFit)[0];
}

// ---------- First-ticket coach ----------

export interface CoachStep {
  label: string;
  hint: string;
  done: boolean;
}

export function coachSteps(sc: Scenario, s: SessionState): CoachStep[] {
  const first = sc.requester.name.split(' ')[0];
  const found = sc.keyFacts.filter((f) => s.revealed.includes(f)).length;
  const sensitive = !!sc.socialEngineering || sc.requiredActions.some((r) => /unlock|reset|enable|disable|grant|wipe|bitlocker/.test(r));
  const steps: CoachStep[] = [
    { label: `Greet ${first}`, hint: 'Reply within a minute. "Canned responses" has a greeting.', done: s.chat.some((m) => m.from === 'agent') },
    {
      label: 'Triage the ticket',
      hint: 'Set category, impact and urgency in Ticket details. Check the logged priority is right.',
      done: !!s.triage?.category && !!triagedPriority(s.triage),
    },
    { label: 'Ask questions', hint: 'Use the suggested questions or type your own. Avoid rude ones.', done: s.asked.length >= 2 },
  ];
  if (sensitive) steps.push({ label: 'Verify identity before account changes', hint: 'Use "Verify identity" in the suggested questions.', done: s.verifyAttempted });
  steps.push(
    {
      label: `Find the cause (${found}/${sc.keyFacts.length} key facts)`,
      hint: 'Check Directory, Remote desktop, Server room, Approvals and the requester’s answers. Findings collect on the right.',
      done: found === sc.keyFacts.length,
    },
    sc.correctOutcome === 'resolve'
      ? { label: 'Apply the fix', hint: 'Use the right tool for the cause, and tell the user before you touch their device.', done: allRequirementsMet(sc, s.actions) }
      : { label: 'Decide who owns it', hint: 'If tier 1 cannot fix it, gather the evidence and escalate to the right team.', done: found === sc.keyFacts.length },
  );
  if (sc.correctOutcome === 'resolve') steps.push({ label: `Confirm with ${first}`, hint: '"Ask them to confirm the fix" before closing.', done: s.confirmed });
  steps.push({ label: 'Resolve with notes and a reply', hint: 'Resolve ticket: root cause, work notes, and a friendly closing message.', done: false });
  return steps;
}

// ---------- Certification exam ----------

export const EXAM_SIZE = 5;
export const EXAM_PASS_AVG = 80;
export const EXAM_PASS_MIN = 60;

/** Five tickets from five different categories, preferring ones not yet passed, mixing difficulties. */
export function pickExam(scenarios: Scenario[], best: Record<string, number>, seed: number): string[] {
  const rot = (n: number) => (seed + n * 7919) % 9973;
  const cats = [...CATEGORIES].sort((a, b) => rot(a.length + CATEGORIES.indexOf(a)) - rot(b.length + CATEGORIES.indexOf(b))).slice(0, EXAM_SIZE);
  return cats.flatMap((c, i) => {
    const pool = scenarios.filter((s) => s.category === c && !s.custom);
    const want = ((i % 3) + 1) as Difficulty;
    const sorted = [...pool].sort(
      (a, b) =>
        Number((best[a.id] ?? 0) >= 70) - Number((best[b.id] ?? 0) >= 70) ||
        Math.abs(a.difficulty - want) - Math.abs(b.difficulty - want) ||
        rot(a.id.length) - rot(b.id.length),
    );
    return sorted[0] ? [sorted[0].id] : [];
  });
}

export function examResult(scores: number[]): { avg: number; min: number; passed: boolean; complete: boolean } {
  const avg = scores.length ? Math.round(scores.reduce((n, x) => n + x, 0) / scores.length) : 0;
  const min = scores.length ? Math.min(...scores) : 0;
  const complete = scores.length >= EXAM_SIZE;
  return { avg, min, complete, passed: complete && avg >= EXAM_PASS_AVG && min >= EXAM_PASS_MIN };
}
