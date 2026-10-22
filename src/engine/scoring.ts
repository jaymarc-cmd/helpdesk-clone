import { ACTION_BY_ID, actionLabel, isInherentlyHarmful } from '../data/actions';
import type { Scenario, ScoreItem, ScoreSection, TicketResult, TicketSubmission } from '../types';
import { requirementMet, type SessionState } from './session';

/** Live-chat first-response target, in seconds. */
export const FIRST_RESPONSE_SEC = 60;

export const HINT_PENALTY = 3;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function includesAny(text: string, words: string[]): string[] {
  const t = text.toLowerCase();
  return words.filter((w) => t.includes(w.toLowerCase()));
}

export function gradeLetter(total: number): string {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

export function xpFor(total: number, difficulty: number): number {
  return Math.round(total * (1 + 0.25 * (difficulty - 1)));
}

export function gradeTicket(
  scenario: Scenario,
  s: SessionState,
  sub: TicketSubmission,
  elapsedSec: number,
): TicketResult {
  const sections: ScoreSection[] = [];
  const relevantIds = new Set([...scenario.requiredActions.flatMap((r) => r.split('|')), ...(scenario.helpfulActions ?? [])]);
  // Harmful: listed by the scenario, or harmful on any ticket (core server reboots, privileged groups) unless the ticket needs it.
  const harmfulDone = s.actions.filter((a) => scenario.harmfulActions?.includes(a) || (isInherentlyHarmful(a) && !relevantIds.has(a)));
  const uniqueHarmful = [...new Set(harmfulDone)];

  // ---- Diagnosis (20)
  {
    const items: ScoreItem[] = [];
    const ok = sub.rootCause === scenario.correctRootCause;
    const correct = scenario.rootCauses.find((r) => r.id === scenario.correctRootCause)?.label ?? '';
    items.push(ok ? { ok, text: `Correct root cause: ${correct}` } : { ok, text: `Root cause was: ${correct}` });
    sections.push({ key: 'diagnosis', label: 'Diagnosis', score: ok ? 20 : 0, max: 20, items });
  }

  // ---- Resolution (20)
  {
    const items: ScoreItem[] = [];
    let score = 0;
    const outcomeOk = sub.outcome === scenario.correctOutcome;
    const teamOk = scenario.correctOutcome !== 'escalate' || sub.team === scenario.escalateTo;
    if (outcomeOk && teamOk) {
      score += 8;
      items.push({
        ok: true,
        text:
          scenario.correctOutcome === 'escalate'
            ? `Correctly escalated to ${scenario.escalateTo}`
            : 'Correct outcome: resolved at tier 1',
      });
    } else if (outcomeOk) {
      score += 4;
      items.push({ ok: false, text: `Right call to escalate, but this belongs with ${scenario.escalateTo}` });
    } else {
      items.push({
        ok: false,
        text:
          scenario.correctOutcome === 'escalate'
            ? `This should have been escalated to ${scenario.escalateTo}`
            : sub.outcome === 'escalate'
              ? 'This could have been resolved at tier 1. Unnecessary escalation.'
              : 'Ticket should have been resolved, not left pending',
      });
    }
    const req = scenario.requiredActions;
    if (req.length === 0) {
      score += outcomeOk ? 12 : 6;
      if (outcomeOk) items.push({ ok: true, text: 'No tier-1 changes were needed, and you did not force one' });
    } else {
      const met = req.filter((r) => requirementMet(r, s.actions));
      score += (12 * met.length) / req.length;
      for (const r of req) {
        const label = r
          .split('|')
          .map((id) => actionLabel(id))
          .join(' or ');
        items.push(requirementMet(r, s.actions) ? { ok: true, text: `Performed: ${label}` } : { ok: false, text: `Missing step: ${label}` });
      }
    }
    if (scenario.socialEngineering && uniqueHarmful.length) {
      score = 0;
      items.push({ ok: false, text: 'You made changes for an unverified caller. The attacker succeeded.' });
    }
    sections.push({ key: 'resolution', label: 'Resolution', score: round1(clamp(score, 0, 20)), max: 20, items });
  }

  // ---- Investigation (10)
  {
    const items: ScoreItem[] = [];
    const key = scenario.keyFacts;
    const found = key.filter((f) => s.revealed.includes(f));
    const score = key.length ? (10 * found.length) / key.length : 10;
    for (const f of key) {
      const label = scenario.facts.find((x) => x.id === f)?.label ?? f;
      items.push({ ok: s.revealed.includes(f), text: s.revealed.includes(f) ? `Found: ${label}` : `Missed: ${label}` });
    }
    sections.push({ key: 'investigation', label: 'Investigation', score: round1(score), max: 10, items });
  }

  // ---- Process & security (15)
  {
    const items: ScoreItem[] = [];
    let score = 15;
    const sensitiveUsed = s.actions.some((a) => ACTION_BY_ID[a]?.sensitive);
    if (s.sensitiveBeforeVerify.length) {
      score -= 8;
      items.push({
        ok: false,
        text: `Sensitive change before verifying identity: ${[...new Set(s.sensitiveBeforeVerify)].map((a) => actionLabel(a)).join(', ')}`,
      });
    } else if (sensitiveUsed) {
      items.push({ ok: true, text: 'Verified identity before making sensitive changes' });
    }
    if (scenario.socialEngineering) {
      items.push(
        s.verifyAttempted
          ? { ok: true, text: 'Attempted identity verification on a suspicious request' }
          : { ok: false, text: 'Never attempted to verify the caller' },
      );
      if (!s.verifyAttempted) score -= 5;
    }
    for (const h of uniqueHarmful) {
      score -= 10;
      items.push({ ok: false, text: `Harmful action: ${actionLabel(h)}` });
    }
    const relevant = new Set([
      ...scenario.requiredActions.flatMap((r) => r.split('|')),
      ...(scenario.helpfulActions ?? []),
      ...(scenario.harmfulActions ?? []),
    ]);
    const unnecessary = [...new Set(s.actions.filter((a) => !relevant.has(a) && !uniqueHarmful.includes(a)))];
    if (unnecessary.length > 1) {
      const pen = Math.min(6, (unnecessary.length - 1) * 2);
      score -= pen;
      items.push({
        ok: false,
        text: `Unnecessary actions (shotgun troubleshooting): ${unnecessary.map((a) => actionLabel(a)).join(', ')}`,
      });
    } else if (!uniqueHarmful.length) {
      items.push({ ok: true, text: 'Targeted troubleshooting, with no shotgun changes' });
    }
    if (scenario.correctOutcome === 'resolve' && sub.outcome === 'resolve') {
      if (s.confirmed) items.push({ ok: true, text: 'Confirmed the fix with the user before resolving' });
      else {
        score -= 3;
        items.push({ ok: false, text: 'Resolved without confirming the fix with the user' });
      }
    }
    sections.push({ key: 'process', label: 'Process & security', score: round1(clamp(score, 0, 15)), max: 15, items });
  }

  // ---- Communication (15)
  {
    const items: ScoreItem[] = [];
    const reply = sub.reply.trim();
    const firstName = scenario.requester.name.split(' ')[0];
    let score = 0;
    const lower = reply.toLowerCase();

    if (lower.includes(firstName.toLowerCase())) {
      score += 3;
      items.push({ ok: true, text: `Addressed ${firstName} by name` });
    } else items.push({ ok: false, text: `Address the requester by name (${firstName})` });

    if (/^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i.test(reply)) {
      score += 1;
      items.push({ ok: true, text: 'Friendly greeting' });
    } else items.push({ ok: false, text: 'Open with a greeting' });

    if (/(thank|sorry|apolog|understand|appreciate|happy to help|glad)/i.test(reply)) {
      score += 2;
      items.push({ ok: true, text: 'Empathy / politeness' });
    } else items.push({ ok: false, text: 'Show empathy (thank them, acknowledge the impact)' });

    const kw = includesAny(reply, scenario.replyKeywords);
    const kwScore = Math.min(1, kw.length / Math.min(2, scenario.replyKeywords.length || 1)) * 3;
    score += kwScore;
    items.push(
      kwScore >= 3
        ? { ok: true, text: 'Explained the cause and fix in plain language' }
        : { ok: false, text: `Explain what happened and what you did (e.g. mention: ${scenario.replyKeywords.join(', ')})` },
    );

    if (/(let (me|us) know|reach out|contact|reply|get back|if (it|this|anything)|any (other|further)|don't hesitate|follow up|update you)/i.test(reply)) {
      score += 2;
      items.push({ ok: true, text: 'Clear next steps / invitation to follow up' });
    } else items.push({ ok: false, text: 'Close with next steps or an invitation to reply' });

    if (reply.length >= 120 && reply.length <= 1500) {
      score += 2;
      items.push({ ok: true, text: 'Appropriate length' });
    } else items.push({ ok: false, text: reply.length < 120 ? 'Reply is too short to be helpful' : 'Reply is too long. Keep it focused.' });

    const blame = includesAny(reply, ['your fault', 'stupid', 'obviously', 'should have known', 'dumb', 'idiot', 'user error', 'pebkac']);
    if (blame.length) {
      score -= 4;
      items.push({ ok: false, text: `Unprofessional wording: ${blame.join(', ')}` });
    } else {
      score += 2;
      items.push({ ok: true, text: 'Professional, blame-free tone' });
    }

    // Live-chat etiquette: tell people before you touch their device, and don't leave them waiting.
    const surprised = s.unannounced ?? [];
    if (surprised.length) {
      score -= 2 * surprised.length;
      const what = surprised.map((x) => (x === 'remote' ? 'connected to' : 'restarted')).join(' and ');
      items.push({ ok: false, text: `You ${what} ${firstName}'s device without telling them first` });
    }
    const nudges = s.nudges ?? 0;
    if (nudges) {
      score -= nudges >= 2 ? 2 : 1;
      items.push({ ok: false, text: `${firstName} had to chase you for an update ${nudges === 1 ? 'once' : `${nudges} times`}. Say "let me check, one moment" before going quiet.` });
    }

    const bad = s.asked.filter((id) => scenario.questions.find((q) => q.id === id)?.quality === 'bad');
    if (bad.length) {
      score -= 2 * bad.length;
      items.push({ ok: false, text: `${bad.length} unprofessional question${bad.length > 1 ? 's' : ''} during the conversation` });
    }
    sections.push({ key: 'communication', label: 'Communication', score: round1(clamp(score, 0, 15)), max: 15, items });
  }

  // ---- Documentation (10)
  {
    const items: ScoreItem[] = [];
    const note = sub.note.trim();
    let score = 0;
    if (note.length >= 80) {
      score += 3;
      items.push({ ok: true, text: 'Detailed work notes' });
    } else items.push({ ok: false, text: 'Work notes are too thin (aim for: symptom, findings, actions, result)' });

    const kw = includesAny(note, scenario.noteKeywords);
    const need = Math.max(1, Math.ceil(scenario.noteKeywords.length / 2));
    const kwScore = Math.min(1, kw.length / need) * 5;
    score += kwScore;
    items.push(
      kwScore >= 5
        ? { ok: true, text: 'Captured the key technical details' }
        : { ok: false, text: `Include key details (e.g. ${scenario.noteKeywords.slice(0, 4).join(', ')})` },
    );

    if (/(resolv|escalat|confirm|verif|tested|works|working|fixed|unlock|reset|clear|enabled|added|deployed|declin|refus)/i.test(note)) {
      score += 2;
      items.push({ ok: true, text: 'Documented actions and result' });
    } else items.push({ ok: false, text: 'State what you did and how you confirmed it' });
    sections.push({ key: 'documentation', label: 'Documentation', score: round1(clamp(score, 0, 10)), max: 10, items });
  }

  // ---- Time (10): 8 for handling time, 2 for a prompt first response
  {
    const target = scenario.targetMinutes * 60;
    let handling = 8;
    if (elapsedSec > target) handling = clamp(8 * (1 - (elapsedSec - target) / target), 0, 8);
    const mm = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`;
    const firstReply = s.chat.find((m) => m.from === 'agent');
    // Sessions saved before messages were timestamped count as prompt.
    const firstAt = firstReply ? (firstReply.at ?? 0) : Infinity;
    const prompt = firstAt <= FIRST_RESPONSE_SEC;
    sections.push({
      key: 'time',
      label: 'Handling time',
      score: round1(handling + (prompt ? 2 : 0)),
      max: 10,
      items: [
        {
          ok: prompt,
          text: firstReply
            ? `First response after ${mm(firstAt)} (target under ${mm(FIRST_RESPONSE_SEC)})`
            : `You never replied to ${scenario.requester.name.split(' ')[0]} in the conversation`,
        },
        {
          ok: elapsedSec <= target,
          text: `Handled in ${mm(elapsedSec)} (target ${scenario.targetMinutes}:00)`,
        },
      ],
    });
  }

  const raw = sections.reduce((n, sec) => n + sec.score, 0);
  const total = Math.round(clamp(raw - s.hintsUsed * HINT_PENALTY, 0, 100));

  const pct = (k: ScoreSection['key']) => {
    const sec = sections.find((x) => x.key === k)!;
    return sec.score / sec.max;
  };
  // How the requester felt during the chat counts as much as the final reply.
  const mood = (s.patience ?? 70) / 100;
  const csatRaw = 1 + 4 * (0.3 * pct('communication') + 0.35 * pct('resolution') + 0.15 * pct('time') + 0.2 * mood);
  const csat = Math.round(clamp(csatRaw, 1, 5) * 2) / 2;

  return { total, grade: gradeLetter(total), csat, sections, xp: xpFor(total, scenario.difficulty) };
}
