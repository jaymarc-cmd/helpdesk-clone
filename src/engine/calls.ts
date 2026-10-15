import type { CallScenario } from '../types';

/** Highest total points reachable on any path through the call (calls are acyclic). */
export function maxCallPoints(call: CallScenario): number {
  const byId = new Map(call.nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id);
    if (!node?.options?.length || seen.has(id)) return 0;
    seen.add(id);
    const best = Math.max(...node.options.map((o) => o.points + visit(o.next, seen)));
    seen.delete(id);
    memo.set(id, best);
    return best;
  };
  return visit(call.start, new Set());
}

export function callScore(points: number, call: CallScenario): number {
  const max = maxCallPoints(call);
  return max > 0 ? Math.max(0, Math.min(100, Math.round((points / max) * 100))) : 0;
}

export function clampMood(m: number): number {
  return Math.max(0, Math.min(10, m));
}

/** Every option must point at an existing node; returns problems found. */
export function validateCall(call: CallScenario): string[] {
  const ids = new Set(call.nodes.map((n) => n.id));
  const errors: string[] = [];
  if (!ids.has(call.start)) errors.push(`${call.id}: start node "${call.start}" missing`);
  for (const n of call.nodes) {
    if (!n.options?.length && !n.ending) errors.push(`${call.id}/${n.id}: dead end without an ending`);
    for (const o of n.options ?? []) if (!ids.has(o.next)) errors.push(`${call.id}/${n.id}: option points at missing node "${o.next}"`);
  }
  return errors;
}
