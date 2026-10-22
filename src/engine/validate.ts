import { ACTION_BY_ID, isKnownAction } from '../data/actions';
import { SERVER_BY_ID } from '../data/servers';
import { KB_BY_ID } from '../data/kb';
import { account as defaultAccount, device as defaultDevice } from '../data/scenarios/base';
import { CATEGORIES, TEAMS, type Scenario } from '../types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  scenario?: Scenario;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

/** Validates a scenario (built-in or user-authored JSON) and fills safe defaults. */
export function validateScenario(input: unknown, takenIds: string[] = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['Scenario must be a JSON object.'], warnings };
  const s = input as Record<string, unknown>;

  for (const f of ['id', 'title', 'description', 'debrief', 'correctRootCause'] as const) {
    if (!isStr(s[f])) errors.push(`"${f}" is required and must be a non-empty string.`);
  }
  if (isStr(s.id) && !/^[a-z0-9-]+$/.test(s.id)) errors.push('"id" may only contain lowercase letters, numbers and dashes.');
  if (isStr(s.id) && takenIds.includes(s.id)) errors.push(`"id" "${s.id}" is already used by another scenario.`);
  if (!CATEGORIES.includes(s.category as never)) errors.push(`"category" must be one of: ${CATEGORIES.join(', ')}.`);
  if (![1, 2, 3].includes(s.difficulty as number)) errors.push('"difficulty" must be 1, 2 or 3.');
  if (!['P1', 'P2', 'P3', 'P4'].includes(s.priority as string)) errors.push('"priority" must be P1, P2, P3 or P4.');
  if (s.related !== undefined) {
    if (!isArr(s.related)) errors.push('"related" must be an array of tickets.');
    else
      (s.related as Record<string, unknown>[]).forEach((r, i) => {
        if (!isStr(r?.id) || !isStr(r?.name) || !isStr(r?.text)) errors.push(`related[${i}] needs "id", "name" and "text".`);
      });
  }
  if (s.reportedPriority !== undefined && !['P1', 'P2', 'P3', 'P4'].includes(s.reportedPriority as string))
    errors.push('"reportedPriority" must be P1, P2, P3 or P4 when set.');
  if (!['email', 'portal', 'phone', 'chat'].includes(s.channel as string)) errors.push('"channel" must be email, portal, phone or chat.');
  if (typeof s.targetMinutes !== 'number' || s.targetMinutes <= 0) errors.push('"targetMinutes" must be a positive number.');

  const r = s.requester as Record<string, unknown> | undefined;
  if (!r || typeof r !== 'object') errors.push('"requester" is required.');
  else for (const f of ['name', 'title', 'department', 'email', 'phone', 'location']) if (!isStr(r[f])) errors.push(`"requester.${f}" is required.`);

  // Facts
  const facts = isArr(s.facts) ? (s.facts as { id?: unknown; label?: unknown }[]) : [];
  if (!isArr(s.facts)) errors.push('"facts" must be an array.');
  const factIds = new Set<string>();
  facts.forEach((f, i) => {
    if (!isStr(f?.id) || !isStr(f?.label)) errors.push(`facts[${i}] needs "id" and "label".`);
    else if (factIds.has(f.id)) errors.push(`Duplicate fact id "${f.id}".`);
    else factIds.add(f.id);
  });
  const checkFacts = (ids: unknown, where: string) => {
    if (ids === undefined) return;
    if (!isArr(ids)) return errors.push(`${where} must be an array of fact ids.`);
    for (const id of ids) if (!factIds.has(id as string)) errors.push(`${where} references unknown fact "${String(id)}".`);
  };
  checkFacts(s.keyFacts, '"keyFacts"');
  if (!isArr(s.keyFacts) || (s.keyFacts as unknown[]).length === 0) errors.push('"keyFacts" must list at least one fact.');

  // Questions
  if (!isArr(s.questions) || (s.questions as unknown[]).length === 0) errors.push('"questions" must contain at least one question.');
  const qIds = new Set<string>();
  ((s.questions as Record<string, unknown>[]) ?? []).forEach((q, i) => {
    if (!isStr(q?.id) || !isStr(q?.text) || !isStr(q?.reply)) errors.push(`questions[${i}] needs "id", "text" and "reply".`);
    if (isStr(q?.id)) {
      if (qIds.has(q.id)) errors.push(`Duplicate question id "${q.id}".`);
      qIds.add(q.id);
    }
    if (!isArr(q?.keywords) || !(q.keywords as unknown[]).length) errors.push(`questions[${i}].keywords must be a non-empty array.`);
    if (q?.quality !== undefined && !['good', 'neutral', 'bad'].includes(q.quality as string)) errors.push(`questions[${i}].quality must be good, neutral or bad.`);
    checkFacts(q?.reveals, `questions[${i}].reveals`);
    checkFacts(q?.requires, `questions[${i}].requires`);
  });

  // Actions
  const checkActions = (ids: unknown, where: string, allowAlt = false) => {
    if (ids === undefined) return;
    if (!isArr(ids)) return errors.push(`${where} must be an array of action ids.`);
    for (const entry of ids as string[]) {
      const parts = allowAlt ? String(entry).split('|') : [String(entry)];
      for (const id of parts) if (!isKnownAction(id)) errors.push(`${where} references unknown action "${id}".`);
    }
  };
  if (!isArr(s.requiredActions)) errors.push('"requiredActions" must be an array (can be empty).');
  checkActions(s.requiredActions, '"requiredActions"', true);
  checkActions(s.helpfulActions, '"helpfulActions"');
  checkActions(s.harmfulActions, '"harmfulActions"');
  if (s.actionResults && typeof s.actionResults === 'object') {
    for (const [id, o] of Object.entries(s.actionResults as Record<string, { result?: unknown; reveals?: unknown }>)) {
      if (!isKnownAction(id)) errors.push(`"actionResults" has unknown action "${id}".`);
      if (!isStr(o?.result)) errors.push(`actionResults.${id}.result is required.`);
      checkFacts(o?.reveals, `actionResults.${id}.reveals`);
    }
  }
  if (s.terminal && typeof s.terminal === 'object') {
    for (const [cmd, o] of Object.entries(s.terminal as Record<string, { reveals?: unknown; whenDone?: { action?: string } }>)) {
      checkFacts(o?.reveals, `terminal["${cmd}"].reveals`);
      if (o?.whenDone && !ACTION_BY_ID[o.whenDone.action ?? '']) errors.push(`terminal["${cmd}"].whenDone.action is not a known action.`);
    }
  }
  if (s.signInLog) checkFacts((s.signInLog as { reveals?: unknown }).reveals, '"signInLog.reveals"');
  if (s.servers !== undefined) {
    if (!s.servers || typeof s.servers !== 'object') errors.push('"servers" must be an object keyed by server id.');
    else
      for (const id of Object.keys(s.servers as object))
        if (!SERVER_BY_ID[id]) errors.push(`"servers" has unknown server "${id}" (known: ${Object.keys(SERVER_BY_ID).join(', ')}).`);
  }
  if (s.toolReveals) {
    const tr = s.toolReveals as Record<string, unknown>;
    checkFacts(tr.directory, '"toolReveals.directory"');
    checkFacts(tr.endpoint, '"toolReveals.endpoint"');
    checkFacts(tr.servers, '"toolReveals.servers"');
  }

  // Resolution
  const causes = isArr(s.rootCauses) ? (s.rootCauses as { id?: unknown; label?: unknown }[]) : [];
  if (causes.length < 2) errors.push('"rootCauses" needs at least two options.');
  causes.forEach((c, i) => {
    if (!isStr(c?.id) || !isStr(c?.label)) errors.push(`rootCauses[${i}] needs "id" and "label".`);
  });
  if (isStr(s.correctRootCause) && !causes.some((c) => c.id === s.correctRootCause)) errors.push('"correctRootCause" must match one of the rootCauses ids.');
  if (!['resolve', 'escalate', 'pending'].includes(s.correctOutcome as string)) errors.push('"correctOutcome" must be resolve, escalate or pending.');
  if (s.correctOutcome === 'escalate' && !TEAMS.includes(s.escalateTo as never)) errors.push(`"escalateTo" must be one of: ${TEAMS.join(', ')}.`);

  for (const f of ['noteKeywords', 'replyKeywords', 'solution'] as const) {
    if (!isArr(s[f]) || !(s[f] as unknown[]).length) errors.push(`"${f}" must be a non-empty array of strings.`);
  }
  if (!isArr(s.kb)) errors.push('"kb" must be an array of article ids (can be empty).');
  else for (const k of s.kb as string[]) if (!KB_BY_ID[k]) warnings.push(`KB article "${k}" does not exist and will be hidden.`);

  if (s.identity !== undefined) {
    const id = s.identity as { verifiable?: unknown; reply?: unknown };
    if (typeof id.verifiable !== 'boolean' || !isStr(id.reply)) errors.push('"identity" needs "verifiable" (boolean) and "reply" (string).');
  }

  if (errors.length) return { ok: false, errors, warnings };

  const username = isStr((s.account as Record<string, unknown> | undefined)?.username)
    ? ((s.account as Record<string, unknown>).username as string)
    : String((r as Record<string, unknown>).email).split('@')[0];
  const scenario = {
    identity: { verifiable: true, reply: 'Sure, go ahead and verify me.' },
    helpfulActions: [],
    harmfulActions: [],
    ...s,
    account: defaultAccount(username, (s.account as object) ?? {}),
    device: defaultDevice(isStr((s.device as Record<string, unknown> | undefined)?.hostname) ? ((s.device as Record<string, unknown>).hostname as string) : 'HPL-LT-9000', (s.device as object) ?? {}),
  } as unknown as Scenario;
  return { ok: true, errors, warnings, scenario };
}

export const SCENARIO_TEMPLATE = {
  id: 'my-first-scenario',
  title: 'Monitor flickering after lunch',
  category: 'Hardware',
  difficulty: 1,
  priority: 'P4',
  channel: 'portal',
  targetMinutes: 5,
  requester: {
    name: 'Alex Rivera',
    title: 'Coordinator',
    department: 'Operations',
    email: 'alex.rivera@hpl.example',
    phone: 'ext. 4410',
    location: 'HQ, Floor 1',
  },
  description: 'My monitor keeps flickering since I came back from lunch. It is giving me a headache.',
  account: { username: 'alex.rivera' },
  device: { hostname: 'HPL-LT-4410' },
  identity: { verifiable: true, reply: 'Employee ID 10001, manager is Sam Lee.' },
  facts: [
    { id: 'cable_loose', label: 'Display cable is loose at the monitor end' },
    { id: 'desk_bumped', label: 'Cleaner moved the desk at lunch' },
  ],
  keyFacts: ['cable_loose', 'desk_bumped'],
  questions: [
    {
      id: 'q_change',
      text: 'Did anything change around your desk?',
      reply: 'The cleaners moved my desk at lunch to vacuum.',
      keywords: ['change', 'moved', 'desk'],
      reveals: ['desk_bumped'],
    },
    {
      id: 'q_bad',
      text: 'Have you tried hitting it?',
      reply: 'No...?',
      keywords: ['hit'],
      quality: 'bad',
    },
  ],
  actionResults: {
    guide_reseat_cable: {
      result: 'Alex pushed the display cable firmly into the monitor. The flicker stopped.',
      reveals: ['cable_loose'],
    },
  },
  requiredActions: ['guide_reseat_cable'],
  helpfulActions: ['guide_restart'],
  harmfulActions: ['reimage'],
  rootCauses: [
    { id: 'cable', label: 'Loose display cable' },
    { id: 'gpu', label: 'Graphics card failure' },
    { id: 'driver', label: 'Display driver issue' },
  ],
  correctRootCause: 'cable',
  correctOutcome: 'resolve',
  noteKeywords: ['cable', 'monitor', 'reseated', 'flicker'],
  replyKeywords: ['cable', 'monitor'],
  kb: ['kb-docks'],
  solution: ['Ask what changed.', 'Have the user reseat the display cable.', 'Confirm the flicker is gone.'],
  debrief: 'Physical changes around a desk are a classic cause of display problems. Check cables before drivers.',
};
