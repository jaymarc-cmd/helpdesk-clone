import { describe, expect, it } from 'vitest';
import { isInherentlyHarmful, isKnownAction } from '../data/actions';
import { CALLS } from '../data/calls';
import { INTERVIEW_QUESTIONS } from '../data/interview';
import { KB_BY_ID } from '../data/kb';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { TEAMS, type ActiveShift, type Level, type Priority, type Scenario, type TicketSubmission } from '../types';
import { loggedPriority, priorityFor } from './triage';
import { handoffVerdict, reopenReason } from './followup';
import { EXAM_SIZE, coachSteps, examResult, pickExam, recommendTicket, targetDifficulty } from './coach';
import { callScore, maxCallPoints, validateCall } from './calls';
import { scoreAnswer } from './interview';
import { BADGES, newlyEarned, rankFor } from './progress';
import { HINT_PENALTY, gradeTicket } from './scoring';
import { initSession, matchQuestion, nextHint, seenAt, sessionReducer, type SessionState } from './session';
import { buildShiftReport, completeShiftTicket, createShift, tickShift } from './shift';
import { runCommand } from './terminal';
import { SCENARIO_TEMPLATE, validateScenario } from './validate';
import { DEFAULT_STATE } from '../state/storage';

const IDEAL_LEVELS: Record<Priority, { impact: Level; urgency: Level }> = {
  P1: { impact: 'High', urgency: 'High' },
  P2: { impact: 'High', urgency: 'Medium' },
  P3: { impact: 'Medium', urgency: 'Medium' },
  P4: { impact: 'Low', urgency: 'Low' },
};

/** Plays the ideal path through a scenario. */
function playIdeal(sc: Scenario): SessionState {
  const step = sessionReducer(sc);
  let s = initSession(sc);
  s = step(s, { type: 'verify', at: 1 });
  s = step(s, { type: 'triage', patch: { category: sc.category, ...IDEAL_LEVELS[sc.priority] }, at: 1 });
  for (const q of sc.questions) if (q.quality !== 'bad') s = step(s, { type: 'ask', questionId: q.id, at: 2 });
  s = step(s, { type: 'openTool', tool: 'directory', at: 3 });
  s = step(s, { type: 'say', text: "I'm going to start a remote session on your computer now, is that okay?", at: 3 });
  s = step(s, { type: 'openTool', tool: 'endpoint', at: 3 });
  s = step(s, { type: 'openTool', tool: 'servers', at: 3 });
  s = step(s, { type: 'openTool', tool: 'approvals', at: 3 });
  s = step(s, { type: 'openTool', tool: 'history', at: 3 });
  s = step(s, { type: 'viewSignInLog', at: 3 });
  for (const cmd of Object.keys(sc.terminal ?? {})) s = step(s, { type: 'command', raw: cmd, at: 4 });
  for (const req of sc.requiredActions) s = step(s, { type: 'action', actionId: req.split('|')[0], at: 5 });
  // Actions whose results reveal key facts (e.g. guided checks) are part of a thorough investigation.
  for (const [id, o] of Object.entries(sc.actionResults ?? {})) {
    if (
      !s.actions.includes(id) &&
      o.reveals?.some((f) => sc.keyFacts.includes(f) && !s.revealed.includes(f)) &&
      !sc.harmfulActions?.includes(id) &&
      (sc.helpfulActions?.includes(id) || sc.requiredActions.some((r) => r.split('|').includes(id)))
    ) {
      s = step(s, { type: 'action', actionId: id, at: 6 });
    }
  }
  for (const r of sc.related ?? []) s = step(s, { type: 'link', id: r.id, at: 6 });
  if (sc.related?.length) s = step(s, { type: 'notify', text: 'We know about the outage and are working on it. Next update in 30 minutes.', at: 6 });
  s = step(s, { type: 'confirm', at: 7 });
  return s;
}

function idealSubmission(sc: Scenario): TicketSubmission {
  const first = sc.requester.name.split(' ')[0];
  return {
    rootCause: sc.correctRootCause,
    outcome: sc.correctOutcome,
    team: sc.escalateTo,
    note: `Verified identity. Findings and actions: ${sc.noteKeywords.join(', ')}. Confirmed result with the user and documented.`,
    reply: `Hi ${first},\n\nThank you for your patience and for reaching out. Here is what happened: ${sc.replyKeywords.join(', ')}. Everything is sorted on our side now.\n\nIf anything else comes up, just reply to this ticket and let us know.\n\nKind regards,\nService Desk`,
  };
}

describe('built-in content', () => {
  it('has unique scenario ids', () => {
    const ids = BUILTIN_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUILTIN_SCENARIOS.map((s) => [s.id, s] as const))('%s passes validation', (_id, sc) => {
    const res = validateScenario(sc, []);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it.each(BUILTIN_SCENARIOS.map((s) => [s.id, s] as const))('%s: ideal path reveals every key fact and scores an A', (_id, sc) => {
    const s = playIdeal(sc);
    const missing = sc.keyFacts.filter((f) => !s.revealed.includes(f));
    expect(missing).toEqual([]);
    const result = gradeTicket(sc, s, idealSubmission(sc), 30);
    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe('A');
  });

  it('every built-in KB reference and action id exists', () => {
    for (const sc of BUILTIN_SCENARIOS) {
      for (const k of sc.kb) expect(KB_BY_ID[k], `${sc.id} kb ${k}`).toBeDefined();
      for (const a of [...sc.requiredActions.flatMap((r) => r.split('|')), ...(sc.harmfulActions ?? [])]) {
        expect(isKnownAction(a), `${sc.id} action ${a}`).toBe(true);
      }
    }
  });

  it.each(CALLS.map((c) => [c.id, c] as const))('call %s is well-formed and winnable', (_id, call) => {
    expect(validateCall(call)).toEqual([]);
    expect(maxCallPoints(call)).toBeGreaterThan(0);
  });

  it('interview questions have key points and samples that score well', () => {
    for (const q of INTERVIEW_QUESTIONS) {
      expect(q.keyPoints.length).toBeGreaterThan(1);
      expect(scoreAnswer(q, q.sampleAnswer, 60).score, q.id).toBeGreaterThanOrEqual(75);
    }
  });
});

describe('grading', () => {
  const vishing = BUILTIN_SCENARIOS.find((s) => s.id === 'sec-vishing-cfo')!;
  const lockout = BUILTIN_SCENARIOS.find((s) => s.id === 'acc-lockout-phone')!;

  it('punishes resetting a password for an unverified social engineer', () => {
    const step = sessionReducer(vishing);
    let s = initSession(vishing);
    s = step(s, { type: 'action', actionId: 'reset_password', at: 5 });
    const r = gradeTicket(vishing, s, { ...idealSubmission(vishing), rootCause: 'locked', outcome: 'resolve' }, 60);
    expect(r.sections.find((x) => x.key === 'resolution')!.score).toBe(0);
    expect(r.sections.find((x) => x.key === 'process')!.score).toBeLessThanOrEqual(2);
    expect(r.total).toBeLessThan(50);
  });

  it('flags sensitive changes made before identity verification', () => {
    const step = sessionReducer(lockout);
    let s = initSession(lockout);
    s = step(s, { type: 'action', actionId: 'unlock_account', at: 5 });
    expect(s.sensitiveBeforeVerify).toEqual(['unlock_account']);
    const r = gradeTicket(lockout, s, idealSubmission(lockout), 60);
    const proc = r.sections.find((x) => x.key === 'process')!;
    expect(proc.items.some((i) => !i.ok && i.text.includes('before verifying'))).toBe(true);
  });

  it('applies the hint penalty', () => {
    const s = playIdeal(lockout);
    const base = gradeTicket(lockout, s, idealSubmission(lockout), 30).total;
    const hinted = gradeTicket(lockout, { ...s, hintsUsed: 2 }, idealSubmission(lockout), 30).total;
    expect(base - hinted).toBe(2 * HINT_PENALTY);
  });

  it('reduces the time score past the target', () => {
    const s = playIdeal(lockout);
    const fast = gradeTicket(lockout, s, idealSubmission(lockout), 60);
    const slow = gradeTicket(lockout, s, idealSubmission(lockout), lockout.targetMinutes * 60 * 2);
    expect(fast.sections.find((x) => x.key === 'time')!.score).toBe(10);
    // Slow to resolve, but the first reply was prompt.
    expect(slow.sections.find((x) => x.key === 'time')!.score).toBe(2);
  });

  it('expects a first response within a minute', () => {
    const step = sessionReducer(lockout);
    const late = step(initSession(lockout), { type: 'say', text: 'Hi Dana, looking into this now.', at: 240 });
    const time = (st: SessionState) => gradeTicket(lockout, st, idealSubmission(lockout), 60).sections.find((x) => x.key === 'time')!;
    expect(time(late).score).toBe(8);
    expect(time(late).items[0].ok).toBe(false);
    expect(time(initSession(lockout)).items[0].text).toMatch(/never replied/);
  });

  it('penalizes blame in the customer reply', () => {
    const s = playIdeal(lockout);
    const sub = idealSubmission(lockout);
    const nice = gradeTicket(lockout, s, sub, 30);
    const rude = gradeTicket(lockout, s, { ...sub, reply: sub.reply + ' Honestly this was user error.' }, 30);
    expect(rude.sections.find((x) => x.key === 'communication')!.score).toBeLessThan(nice.sections.find((x) => x.key === 'communication')!.score);
  });

  it('accepts either alternative of an "a|b" requirement', () => {
    const dns = BUILTIN_SCENARIOS.find((s) => s.id === 'net-dns-intranet')!;
    const step = sessionReducer(dns);
    let s = initSession(dns);
    s = step(s, { type: 'action', actionId: 'guide_restart', at: 5 });
    const r = gradeTicket(dns, s, idealSubmission(dns), 30);
    expect(r.sections.find((x) => x.key === 'resolution')!.items.some((i) => i.ok && i.text.includes('Flush DNS'))).toBe(true);
  });
});

describe('session & terminal', () => {
  const apipa = BUILTIN_SCENARIOS.find((s) => s.id === 'net-apipa')!;
  const dns = BUILTIN_SCENARIOS.find((s) => s.id === 'net-dns-intranet')!;

  it('matches free-typed messages to questions by keywords', () => {
    expect(matchQuestion(apipa, 'are there any lights on the port?', [])?.id).toBe('q_lights');
    expect(matchQuestion(apipa, 'what is your favourite colour', [])).toBeUndefined();
  });

  it('updates device state after a fix and terminal output follows it', () => {
    const step = sessionReducer(apipa);
    let s = initSession(apipa);
    expect(runCommand('ipconfig', apipa, s.device, s.account, s.actions).output).toContain('Autoconfiguration IPv4 Address');
    s = step(s, { type: 'action', actionId: 'guide_reseat_cable', at: 1 });
    expect(s.device.online).toBe(true);
    const out = runCommand('ipconfig', apipa, s.device, s.account, s.actions).output;
    expect(out).toContain('10.20.3.114');
    expect(out).not.toContain('Autoconfiguration');
  });

  it('ipconfig /flushdns performs the flush action and switches whenDone output', () => {
    const step = sessionReducer(dns);
    let s = initSession(dns);
    s = step(s, { type: 'command', raw: 'ping timesheets.hpl.example', at: 1 });
    expect(s.terminal[0].output).toContain('10.10.5.20');
    s = step(s, { type: 'command', raw: 'IPCONFIG   /flushdns', at: 2 });
    expect(s.actions).toContain('flush_dns');
    s = step(s, { type: 'command', raw: 'ping timesheets.hpl.example', at: 3 });
    expect(s.terminal[2].output).toContain('10.10.8.45');
  });

  it('reports unknown commands like Windows does', () => {
    const s = initSession(dns);
    expect(runCommand('frobnicate', dns, s.device, s.account, []).output).toContain('is not recognized');
  });

  it('gives a hint that points at the next missing key fact', () => {
    const lockout = BUILTIN_SCENARIOS.find((s) => s.id === 'acc-lockout-phone')!;
    const step = sessionReducer(lockout);
    let s = initSession(lockout);
    expect(nextHint(lockout, s)).toMatch(/verify/i);
    s = step(s, { type: 'verify', at: 1 });
    expect(nextHint(lockout, s)).toMatch(/triage/i);
    s = step(s, { type: 'triage', patch: { category: 'Accounts', impact: 'Medium', urgency: 'Medium' }, at: 2 });
    expect(nextHint(lockout, s)).toMatch(/phone|tablet/i);
  });
});

describe('workstation tools', () => {
  const printServer = BUILTIN_SCENARIOS.find((s) => s.id === 'hw-print-server')!;
  const access = BUILTIN_SCENARIOS.find((s) => s.id === 'acc-group-access')!;

  it('restarting a stopped service in the Server room fixes the server', () => {
    const step = sessionReducer(printServer);
    let s = initSession(printServer);
    expect(s.servers.find((x) => x.id === 'PRINT01')!.status).toBe('Degraded');
    s = step(s, { type: 'action', actionId: 'srv:PRINT01:restart:Print Spooler', at: 5 });
    const p = s.servers.find((x) => x.id === 'PRINT01')!;
    expect(p.status).toBe('Healthy');
    expect(p.services.every((x) => x.status === 'Running')).toBe(true);
  });

  it('cannot reboot an unreachable switch, and core server reboots count as harmful', () => {
    const outage = BUILTIN_SCENARIOS.find((s) => s.id === 'net-floor-outage')!;
    const step = sessionReducer(outage);
    let s = initSession(outage);
    s = step(s, { type: 'action', actionId: 'srv:SW-F3-EAST:reboot', at: 5 });
    expect(s.actionResults[0].text).toMatch(/not responding/);
    expect(isInherentlyHarmful('srv:DC01:reboot')).toBe(true);
    expect(isInherentlyHarmful('srv:PRINT01:reboot')).toBe(false);
    s = step(s, { type: 'action', actionId: 'srv:DC01:reboot', at: 6 });
    const r = gradeTicket(outage, s, idealSubmission(outage), 60);
    expect(r.sections.find((x) => x.key === 'process')!.items.some((i) => !i.ok && i.text.includes('Reboot DC01'))).toBe(true);
  });

  it('group changes update membership; privileged groups are harmful', () => {
    const step = sessionReducer(access);
    let s = initSession(access);
    s = step(s, { type: 'action', actionId: 'grp+:FIN-Reports-RW', at: 5 });
    expect(s.account.groups).toContain('FIN-Reports-RW');
    s = step(s, { type: 'action', actionId: 'grp-:Finance - Read', at: 6 });
    expect(s.account.groups).not.toContain('Finance - Read');
    expect(isInherentlyHarmful('grp+:Domain Admins')).toBe(true);
  });

  it('the user only confirms once the fix is actually done, and resolving unconfirmed costs points', () => {
    const step = sessionReducer(printServer);
    let s = initSession(printServer);
    s = step(s, { type: 'confirm', at: 2 });
    expect(s.confirmed).toBe(false);
    s = step(s, { type: 'action', actionId: 'srv:PRINT01:restart:Print Spooler', at: 3 });
    const unconfirmed = gradeTicket(printServer, s, idealSubmission(printServer), 30);
    s = step(s, { type: 'confirm', at: 4 });
    expect(s.confirmed).toBe(true);
    const confirmed = gradeTicket(printServer, s, idealSubmission(printServer), 30);
    const proc = (r: typeof confirmed) => r.sections.find((x) => x.key === 'process')!.score;
    expect(proc(confirmed) - proc(unconfirmed)).toBe(3);
  });
});

describe('triage', () => {
  it('maps impact and urgency to priority', () => {
    for (const [p, l] of Object.entries(IDEAL_LEVELS)) expect(priorityFor(l.impact, l.urgency)).toBe(p);
    expect(priorityFor('Low', 'High')).toBe('P3');
  });

  it('expects mis-logged tickets to be re-prioritised', () => {
    const sc = BUILTIN_SCENARIOS.find((x) => x.id === 'net-floor-outage')!;
    expect(loggedPriority(sc)).toBe('P3');
    const step = sessionReducer(sc);
    const doc = (st: SessionState) => gradeTicket(sc, st, idealSubmission(sc), 30).sections.find((x) => x.key === 'documentation')!;
    const asLogged = step(initSession(sc), { type: 'triage', patch: { category: 'Network', impact: 'Medium', urgency: 'Medium' }, at: 1 });
    const corrected = step(initSession(sc), { type: 'triage', patch: { category: 'Network', impact: 'High', urgency: 'High' }, at: 1 });
    expect(doc(corrected).score - doc(asLogged).score).toBe(2);
    expect(doc(asLogged).items.find((i) => i.text.startsWith('Priority'))!.ok).toBe(false);
    expect(doc(initSession(sc)).items.some((i) => /Set the ticket category/.test(i.text))).toBe(true);
  });
});

describe('follow-up', () => {
  const outage = BUILTIN_SCENARIOS.find((x) => x.id === 'net-floor-outage')!;

  it('expects related tickets to be linked and everyone updated', () => {
    const proc = (st: SessionState) => gradeTicket(outage, st, idealSubmission(outage), 30).sections.find((x) => x.key === 'process')!;
    const full = playIdeal(outage);
    expect(full.linked).toHaveLength(outage.related!.length);
    const lone = { ...full, linked: [], notified: '' };
    expect(proc(full).score - proc(lone).score).toBe(4);
  });

  it('a resolution that was never confirmed or applied comes back reopened, once', () => {
    const sc = BUILTIN_SCENARIOS.find((x) => x.id === 'hw-slow-disk')!;
    const ideal = playIdeal(sc);
    expect(reopenReason(sc, ideal, 'resolve', sc.correctRootCause)).toBeUndefined();
    expect(reopenReason(sc, initSession(sc), 'resolve', sc.correctRootCause)).toMatch(/never actually applied/);
    expect(reopenReason(sc, { ...ideal, confirmed: false }, 'resolve', sc.correctRootCause)).toMatch(/Nobody checked/);
    const reopened = sessionReducer(sc)(initSession(sc), { type: 'reopen', attemptId: 't1', ticket: 'INC-1', at: 0 });
    expect(reopened.chat[0].text).toMatch(/Reopened/);
    expect(reopenReason(sc, reopened, 'resolve', 'x')).toBeUndefined();
  });

  it('the receiving team judges an escalation', () => {
    const sc = BUILTIN_SCENARIOS.find((x) => x.correctOutcome === 'escalate' && x.escalateTo)!;
    const s = playIdeal(sc);
    const attempt = (team: string, note = idealSubmission(sc).note) => {
      const sub = { ...idealSubmission(sc), team: team as never, note };
      return { submission: sub, result: gradeTicket(sc, s, sub, 30) } as never;
    };
    expect(handoffVerdict(sc, attempt(sc.escalateTo!))!.verdict).toBe('accepted');
    const other = TEAMS.find((t) => t !== sc.escalateTo)!;
    expect(handoffVerdict(sc, attempt(other))!.verdict).toBe('reassigned');
    expect(handoffVerdict(sc, attempt(sc.escalateTo!, 'Escalated.'))!.verdict).toBe('returned');
  });
});

describe('coach, exam and recommendations', () => {
  const t = (total: number, difficulty: 1 | 2 | 3) => ({ result: { total }, difficulty }) as never;

  it('recommended difficulty follows recent scores', () => {
    expect(targetDifficulty([])).toBe(1);
    expect(targetDifficulty([t(90, 1), t(95, 1), t(88, 1)])).toBe(2);
    expect(targetDifficulty([t(40, 3), t(50, 3), t(55, 3)])).toBe(2);
    expect(targetDifficulty([t(70, 2)])).toBe(2);
    const pick = recommendTicket(BUILTIN_SCENARIOS, {}, 'Network', [t(95, 2), t(92, 2), t(90, 2)]);
    expect(pick!.category).toBe('Network');
    expect(pick!.difficulty).toBe(3);
  });

  it('the coach ticks steps off as the ideal path is played', () => {
    const sc = BUILTIN_SCENARIOS.find((x) => x.id === 'hw-slow-disk')!;
    const before = coachSteps(sc, initSession(sc));
    expect(before.every((x) => !x.done)).toBe(true);
    const after = coachSteps(sc, playIdeal(sc));
    expect(after.filter((x) => !x.done).map((x) => x.label)).toEqual(['Resolve with notes and a reply']);
  });

  it('the exam picks five tickets from five categories and needs 80 average, none below 60', () => {
    const ids = pickExam(BUILTIN_SCENARIOS, {}, 1234);
    expect(ids).toHaveLength(EXAM_SIZE);
    const cats = ids.map((id) => BUILTIN_SCENARIOS.find((x) => x.id === id)!.category);
    expect(new Set(cats).size).toBe(EXAM_SIZE);
    expect(examResult([90, 85, 80, 75, 82]).passed).toBe(true);
    expect(examResult([100, 100, 100, 100, 55]).passed).toBe(false);
    expect(examResult([90, 90]).complete).toBe(false);
  });
});

describe('live chat', () => {
  const sc = BUILTIN_SCENARIOS.find((x) => x.id === 'sw-teams-camera')!;
  const step = sessionReducer(sc);
  const last = (s: SessionState) => s.chat[s.chat.length - 1];

  it('stamps every message with the time it was sent', () => {
    const s = step(initSession(sc), { type: 'say', text: 'Hello Rafael, thanks for reaching out!', at: 42 });
    expect(s.chat.slice(-2).map((m) => m.at)).toEqual([42, 42]);
    expect(s.greeted).toBe(true);
    expect(last(s).from).toBe('requester');
  });

  it('answers small talk naturally instead of "I do not understand"', () => {
    const s = step(initSession(sc), { type: 'say', text: 'Let me check a few things, one moment please.', at: 10 });
    expect(last(s).text).not.toMatch(/not sure what you mean/i);
    expect(s.holdUntil).toBeGreaterThan(10);
  });

  it('chases after a long silence, but not while the analyst said they were checking', () => {
    let s = step(initSession(sc), { type: 'say', text: 'Hi Rafael!', at: 0 });
    expect(step(s, { type: 'nudge', at: 60 }).nudges).toBe(0);
    const chased = step(s, { type: 'nudge', at: 100 });
    expect(chased.nudges).toBe(1);
    expect(chased.patience).toBeLessThan(s.patience);
    s = step(s, { type: 'say', text: 'Let me have a look, bear with me.', at: 10 });
    expect(step(s, { type: 'nudge', at: 120 }).nudges).toBe(0);
    expect(step(s, { type: 'nudge', at: 200 }).nudges).toBe(1);
  });

  it('stops chasing after three nudges', () => {
    let s = initSession(sc);
    for (let t = 100; t <= 1000; t += 100) s = step(s, { type: 'nudge', at: t });
    expect(s.nudges).toBe(3);
  });

  it('notices an unannounced remote session and costs communication points', () => {
    const surprised = step(initSession(sc), { type: 'openTool', tool: 'endpoint', at: 5 });
    expect(last(surprised).text).toMatch(/is that you/i);
    expect(surprised.unannounced).toEqual(['remote']);
    const told = step(step(initSession(sc), { type: 'say', text: 'Can I remote into your laptop to take a look?', at: 4 }), { type: 'openTool', tool: 'endpoint', at: 5 });
    expect(told.unannounced).toEqual([]);
    const comm = (st: SessionState) => gradeTicket(sc, st, idealSubmission(sc), 30).sections.find((x) => x.key === 'communication')!.score;
    expect(comm(surprised)).toBeLessThan(comm(told));
  });

  it('a typed restart request is the guided restart step', () => {
    const s = step(initSession(sc), { type: 'say', text: 'Could you restart your laptop for me?', at: 8 });
    expect(s.actions).toContain('guide_restart');
    expect(s.chat.filter((m) => m.text.startsWith('[Guided step]'))).toEqual([]);
  });

  it('email and portal requesters answer later; live chat answers now', () => {
    const portal = BUILTIN_SCENARIOS.find((x) => x.id === 'hw-slow-disk')!;
    const p = sessionReducer(portal)(initSession(portal), { type: 'say', text: 'Hi Rafael, looking into this now.', at: 10 });
    expect(p.async).toBe(true);
    expect(last(p).at).toBeGreaterThan(10 + 15);
    const live = step(initSession(sc), { type: 'say', text: 'Hi, looking into this now.', at: 10 });
    expect(last(live).at).toBe(10);
  });

  it('an email answer brings its findings when it arrives, not when the question is sent', () => {
    const portal = BUILTIN_SCENARIOS.find((x) => x.id === 'hw-slow-disk')!;
    const s = sessionReducer(portal)(initSession(portal), { type: 'ask', questionId: 'q_files', at: 30 });
    const arrives = last(s).at!;
    expect(s.revealed).toContain('videos');
    expect(seenAt(s, arrives - 1).revealed).not.toContain('videos');
    expect(seenAt(s, arrives).revealed).toContain('videos');
    // Live chat: known straight away.
    const chat = BUILTIN_SCENARIOS.find((x) => x.channel === 'chat' && x.questions.some((q) => q.reveals?.length))!;
    const q = chat.questions.find((x) => x.reveals?.length && !x.requires?.length)!;
    const c = sessionReducer(chat)(initSession(chat), { type: 'ask', questionId: q.id, at: 30 });
    expect(seenAt(c, 30).revealed).toEqual(c.revealed);
  });

  it('on hold for the user: they reply when they come back, and do not chase straight away', () => {
    let s = step(initSession(sc), { type: 'hold', reason: 'Awaiting user', at: 20 });
    expect(last(s)).toMatchObject({ from: 'system', text: 'Ticket on hold: Awaiting user' });
    s = step(s, { type: 'resume', reason: 'Awaiting user', byUser: true, at: 300 });
    expect(last(s).from).toBe('requester');
    expect(step(s, { type: 'nudge', at: 400 }).nudges).toBe(0);
  });

  it('work notes stay internal', () => {
    const s = step(initSession(sc), { type: 'note', text: 'C: has 1.1 GB free', at: 9 });
    expect(last(s)).toMatchObject({ from: 'note', at: 9 });
    expect(s.chat.filter((m) => m.from === 'requester')).toHaveLength(1);
  });
});

describe('shift engine', () => {
  it('delivers tickets over time and builds a report', () => {
    const t0 = 1_000_000;
    let shift = createShift(BUILTIN_SCENARIOS, 15, t0, () => 0.5);
    expect(shift.tickets.length).toBe(2);
    const pendingBefore = shift.pending.length;
    shift = tickShift(shift, shift.nextArrivalAt + 1);
    expect(shift.tickets.length).toBe(3);
    expect(shift.pending.length).toBe(pendingBefore - 1);

    const sc = BUILTIN_SCENARIOS.find((s) => s.id === shift.tickets[0].scenarioId)!;
    const attempt = {
      id: 'a1',
      scenarioId: sc.id,
      title: sc.title,
      category: sc.category,
      difficulty: sc.difficulty,
      mode: 'shift' as const,
      completedAt: new Date(t0).toISOString(),
      durationSec: 60,
      result: gradeTicket(sc, playIdeal(sc), idealSubmission(sc), 60),
      submission: idealSubmission(sc),
      log: [],
      hintsUsed: 0,
    };
    shift = completeShiftTicket(shift, sc, attempt, t0 + 60_000);
    const report = buildShiftReport(shift, [attempt], (id) => BUILTIN_SCENARIOS.find((s) => s.id === id), t0 + 120_000);
    expect(report.handled).toBe(1);
    expect(report.avgScore).toBeGreaterThanOrEqual(90);
    expect(report.breaches).toBe(0);

    // Re-triaged up to P1 (8 min SLA): closing after 9 minutes breaches, though the logged priority would not.
    const s2: ActiveShift = { startedAt: t0, durationMin: 25, tickets: [{ scenarioId: sc.id, arrivedAt: t0, status: 'waiting' }], pending: [], nextArrivalAt: t0 + 1e9 };
    const at9 = t0 + 9 * 60_000;
    expect(completeShiftTicket(s2, sc, attempt, at9, 'P1').tickets[0]).toMatchObject({ slaBreached: true, priority: 'P1' });
    expect(completeShiftTicket(s2, sc, attempt, at9, 'P4').tickets[0].slaBreached).toBe(false);
  });
});

describe('progress', () => {
  it('awards first-ticket badge and ranks by XP', () => {
    const sc = BUILTIN_SCENARIOS[0];
    const state = {
      ...DEFAULT_STATE,
      tickets: [
        {
          id: 'x',
          scenarioId: sc.id,
          title: sc.title,
          category: sc.category,
          difficulty: sc.difficulty,
          mode: 'practice' as const,
          completedAt: new Date().toISOString(),
          durationSec: 30,
          result: gradeTicket(sc, playIdeal(sc), idealSubmission(sc), 30),
          submission: idealSubmission(sc),
          log: [],
          hintsUsed: 0,
        },
      ],
    };
    expect(newlyEarned(state)).toContain('first_ticket');
    expect(rankFor(0).current.title).toBe('Trainee');
    expect(rankFor(100000).next).toBeUndefined();
    expect(BADGES.length).toBeGreaterThan(10);
  });

  it('call score is normalised to 0-100', () => {
    const call = CALLS[0];
    expect(callScore(maxCallPoints(call), call)).toBe(100);
    expect(callScore(-50, call)).toBe(0);
  });
});

describe('scenario builder validation', () => {
  it('accepts the template', () => {
    const res = validateScenario(SCENARIO_TEMPLATE, BUILTIN_SCENARIOS.map((s) => s.id));
    expect(res.errors).toEqual([]);
    expect(res.scenario?.account.username).toBe('alex.rivera');
  });

  it('rejects broken references', () => {
    const res = validateScenario({ ...SCENARIO_TEMPLATE, requiredActions: ['nope'], keyFacts: ['ghost'] }, []);
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/unknown action "nope"/);
    expect(res.errors.join(' ')).toMatch(/unknown fact "ghost"/);
  });

  it('rejects duplicate ids', () => {
    const res = validateScenario({ ...SCENARIO_TEMPLATE, id: 'acc-lockout-phone' }, ['acc-lockout-phone']);
    expect(res.ok).toBe(false);
  });
});
