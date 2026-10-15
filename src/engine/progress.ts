import { BUILTIN_SCENARIOS } from '../data/scenarios';
import type { AppState, Category } from '../types';
import { CATEGORIES } from '../types';

export const RANKS = [
  { xp: 0, title: 'Trainee' },
  { xp: 400, title: 'Tier 1 Analyst' },
  { xp: 1200, title: 'Senior Tier 1 Analyst' },
  { xp: 2500, title: 'Tier 2 Technician' },
  { xp: 4500, title: 'Systems Specialist' },
  { xp: 7000, title: 'Service Desk Lead' },
  { xp: 10000, title: 'IT Operations Legend' },
];

export function totalXp(s: AppState): number {
  return (
    s.tickets.reduce((n, t) => n + t.result.xp, 0) +
    s.calls.reduce((n, c) => n + Math.round(c.score * 0.8), 0) +
    s.interviews.reduce((n, i) => n + Math.round(i.score), 0) +
    s.shifts.reduce((n, sh) => n + 50 + sh.handled * 10, 0)
  );
}

export function rankFor(xp: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.xp) idx = i;
  });
  const current = RANKS[idx];
  const next = RANKS[idx + 1];
  const progress = next ? (xp - current.xp) / (next.xp - current.xp) : 1;
  return { current, next, progress, level: idx + 1 };
}

export function bestByScenario(s: AppState): Record<string, number> {
  const best: Record<string, number> = {};
  for (const t of s.tickets) best[t.scenarioId] = Math.max(best[t.scenarioId] ?? 0, t.result.total);
  return best;
}

export function categoryStats(s: AppState): Record<Category, { attempts: number; avg: number; completed: number; total: number }> {
  const out = {} as Record<Category, { attempts: number; avg: number; completed: number; total: number }>;
  const best = bestByScenario(s);
  for (const c of CATEGORIES) {
    const ts = s.tickets.filter((t) => t.category === c);
    const builtins = BUILTIN_SCENARIOS.filter((x) => x.category === c);
    out[c] = {
      attempts: ts.length,
      avg: ts.length ? Math.round(ts.reduce((n, t) => n + t.result.total, 0) / ts.length) : 0,
      completed: builtins.filter((x) => (best[x.id] ?? 0) >= 70).length,
      total: builtins.length,
    };
  }
  return out;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  /** Icon name, resolved to a glyph by components/icons.tsx (BADGE_ICON). */
  icon: string;
  check: (s: AppState) => boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const BADGES: BadgeDef[] = [
  { id: 'first_ticket', name: 'First Ticket', description: 'Close your first ticket.', icon: 'ticket', check: (s) => s.tickets.length >= 1 },
  { id: 'ten_tickets', name: 'Queue Crusher', description: 'Close 10 tickets.', icon: 'layers', check: (s) => s.tickets.length >= 10 },
  { id: 'fifty_tickets', name: 'Desk Veteran', description: 'Close 50 tickets.', icon: 'medal', check: (s) => s.tickets.length >= 50 },
  { id: 'ace', name: 'Flawless', description: 'Score 95 or more on a ticket.', icon: 'gem', check: (s) => s.tickets.some((t) => t.result.total >= 95) },
  {
    id: 'no_hints_a',
    name: 'Unassisted',
    description: 'Earn an A on a difficulty 3 ticket without hints.',
    icon: 'brain',
    check: (s) => s.tickets.some((t) => t.difficulty === 3 && t.hintsUsed === 0 && t.result.total >= 90),
  },
  {
    id: 'sentinel',
    name: 'Security Sentinel',
    description: 'Shut down a social engineering attempt with zero harmful actions.',
    icon: 'shield-check',
    check: (s) =>
      s.tickets.some(
        (t) => t.scenarioId === 'sec-vishing-cfo' && t.result.sections.find((x) => x.key === 'resolution')!.score >= 15,
      ),
  },
  {
    id: 'speedster',
    name: 'Speed Runner',
    description: 'Score 80+ in under half the target time.',
    icon: 'zap',
    check: (s) =>
      s.tickets.some((t) => {
        const sc = BUILTIN_SCENARIOS.find((x) => x.id === t.scenarioId);
        return !!sc && t.result.total >= 80 && t.durationSec <= sc.targetMinutes * 30;
      }),
  },
  {
    id: 'streak5',
    name: 'On a Roll',
    description: 'Score 80+ on five tickets in a row.',
    icon: 'flame',
    check: (s) => {
      let run = 0;
      for (const t of s.tickets) {
        run = t.result.total >= 80 ? run + 1 : 0;
        if (run >= 5) return true;
      }
      return false;
    },
  },
  {
    id: 'csat5',
    name: 'Five Stars',
    description: 'Get a 5-star customer satisfaction rating.',
    icon: 'star',
    check: (s) => s.tickets.some((t) => t.result.csat >= 5),
  },
  {
    id: 'all_categories',
    name: 'Generalist',
    description: 'Pass (70+) at least one ticket in every category.',
    icon: 'compass',
    check: (s) => CATEGORIES.every((c) => s.tickets.some((t) => t.category === c && t.result.total >= 70)),
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Pass (70+) every built-in ticket.',
    icon: 'trophy',
    check: (s) => {
      const best = bestByScenario(s);
      return BUILTIN_SCENARIOS.every((x) => (best[x.id] ?? 0) >= 70);
    },
  },
  { id: 'first_call', name: 'On the Line', description: 'Complete a voice call.', icon: 'phone', check: (s) => s.calls.length >= 1 },
  { id: 'call_pro', name: 'Golden Voice', description: 'Score 90+ on a call.', icon: 'mic', check: (s) => s.calls.some((c) => c.score >= 90) },
  {
    id: 'interview_ready',
    name: 'Interview Ready',
    description: 'Average 75+ across a mock interview.',
    icon: 'briefcase',
    check: (s) => s.interviews.some((i) => i.score >= 75),
  },
  { id: 'shift_done', name: 'Shift Survivor', description: 'Complete a full shift.', icon: 'timer', check: (s) => s.shifts.length >= 1 },
  {
    id: 'shift_clean',
    name: 'Zero Breaches',
    description: 'Finish a shift with 4+ tickets handled and no SLA breaches.',
    icon: 'circle-check',
    check: (s) => s.shifts.some((sh) => sh.handled >= 4 && sh.breaches === 0),
  },
  { id: 'reader', name: 'Bookworm', description: 'Read 10 knowledge base articles.', icon: 'book-open', check: (s) => s.kbRead.length >= 10 },
  { id: 'builder', name: 'Scenario Author', description: 'Create a custom scenario.', icon: 'wrench', check: (s) => s.customScenarios.length >= 1 },
];

export function newlyEarned(s: AppState): string[] {
  const have = new Set(s.badges.map((b) => b.id));
  return BADGES.filter((b) => !have.has(b.id) && b.check(s)).map((b) => b.id);
}

export function overallStats(s: AppState) {
  return {
    tickets: s.tickets.length,
    avgScore: Math.round(avg(s.tickets.map((t) => t.result.total))),
    avgCsat: Math.round(avg(s.tickets.map((t) => t.result.csat)) * 10) / 10,
    calls: s.calls.length,
    interviews: s.interviews.length,
    shifts: s.shifts.length,
  };
}
