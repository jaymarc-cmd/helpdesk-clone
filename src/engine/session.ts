import { ACTION_BY_ID } from '../data/actions';
import type { AccountState, DeviceState, Question, Scenario, WorkLogEntry } from '../types';
import { runCommand } from './terminal';

export const VERIFY_QUESTION_ID = '__verify';

export interface ChatMessage {
  from: 'agent' | 'requester' | 'system';
  text: string;
}

export interface TerminalLine {
  cmd: string;
  output: string;
}

export interface SessionState {
  account: AccountState;
  device: DeviceState;
  asked: string[];
  chat: ChatMessage[];
  revealed: string[];
  actions: string[];
  actionResults: { id: string; text: string }[];
  verified: boolean;
  verifyAttempted: boolean;
  sensitiveBeforeVerify: string[];
  terminal: TerminalLine[];
  kbOpened: string[];
  signInLogViewed: boolean;
  log: WorkLogEntry[];
  hintsUsed: number;
}

export type SessionEvent =
  | { type: 'ask'; questionId: string; at: number }
  | { type: 'say'; text: string; at: number }
  | { type: 'verify'; at: number }
  | { type: 'action'; actionId: string; at: number }
  | { type: 'command'; raw: string; at: number }
  | { type: 'openTool'; tool: 'directory' | 'endpoint'; at: number }
  | { type: 'viewSignInLog'; at: number }
  | { type: 'openKb'; id: string; at: number }
  | { type: 'hint'; text: string; at: number };

export function initSession(scenario: Scenario): SessionState {
  return {
    account: structuredClone(scenario.account),
    device: structuredClone(scenario.device),
    asked: [],
    chat: [{ from: 'requester', text: scenario.description }],
    revealed: [],
    actions: [],
    actionResults: [],
    verified: false,
    verifyAttempted: false,
    sensitiveBeforeVerify: [],
    terminal: [],
    kbOpened: [],
    signInLogViewed: false,
    log: [{ at: 0, kind: 'system', text: `Ticket opened (${scenario.channel}, ${scenario.priority})` }],
    hintsUsed: 0,
  };
}

const uniq = (xs: string[]) => [...new Set(xs)];

function reveal(state: SessionState, ids: string[] | undefined): string[] {
  return ids?.length ? uniq([...state.revealed, ...ids]) : state.revealed;
}

/** Best-matching unasked question for a free-typed message, by keyword hits. */
export function matchQuestion(scenario: Scenario, text: string, asked: string[]): Question | undefined {
  const t = ` ${text.toLowerCase()} `;
  let best: { q: Question; score: number } | undefined;
  for (const q of scenario.questions) {
    if (asked.includes(q.id)) continue;
    const score = q.keywords.reduce((n, k) => (t.includes(k.toLowerCase()) ? n + (k.includes(' ') ? 2 : 1) : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { q, score };
  }
  return best?.q;
}

export function isVerifyMessage(text: string): boolean {
  return /\b(verify|verification|employee id|confirm your identity|security questions?)\b/i.test(text);
}

export function sessionReducer(scenario: Scenario) {
  return (state: SessionState, ev: SessionEvent): SessionState => {
    const firstName = scenario.requester.name.split(' ')[0];
    switch (ev.type) {
      case 'verify': {
        if (state.verifyAttempted) return state;
        const verified = scenario.identity.verifiable;
        return {
          ...state,
          verifyAttempted: true,
          verified,
          chat: [
            ...state.chat,
            { from: 'agent', text: `Before I make any changes, I need to verify your identity. Can you confirm your employee ID and your manager's name?` },
            { from: 'requester', text: scenario.identity.reply },
            {
              from: 'system',
              text: verified
                ? `Identity verified: details match the directory record for ${scenario.requester.name}.`
                : 'Identity NOT verified: details could not be matched to the directory.',
            },
          ],
          log: [...state.log, { at: ev.at, kind: 'question', text: verified ? 'Identity verified' : 'Identity verification failed' }],
        };
      }
      case 'ask': {
        const q = scenario.questions.find((x) => x.id === ev.questionId);
        if (!q || state.asked.includes(q.id)) return state;
        return {
          ...state,
          asked: [...state.asked, q.id],
          chat: [...state.chat, { from: 'agent', text: q.text }, { from: 'requester', text: q.reply }],
          revealed: reveal(state, q.reveals),
          log: [...state.log, { at: ev.at, kind: 'question', text: `Asked: ${q.text}` }],
        };
      }
      case 'say': {
        const text = ev.text.trim();
        if (!text) return state;
        if (isVerifyMessage(text) && !state.verifyAttempted) {
          return sessionReducer(scenario)(state, { type: 'verify', at: ev.at });
        }
        const q = matchQuestion(scenario, text, state.asked);
        if (q) {
          return {
            ...state,
            asked: [...state.asked, q.id],
            chat: [...state.chat, { from: 'agent', text }, { from: 'requester', text: q.reply }],
            revealed: reveal(state, q.reveals),
            log: [...state.log, { at: ev.at, kind: 'question', text: `Asked: ${text}` }],
          };
        }
        return {
          ...state,
          chat: [
            ...state.chat,
            { from: 'agent', text },
            {
              from: 'requester',
              text: `Sorry, I'm not sure what you mean. Could you ask that another way? (${firstName} didn't understand. Try a more specific question or pick a suggestion.)`,
            },
          ],
          log: [...state.log, { at: ev.at, kind: 'question', text: `Said: ${text}` }],
        };
      }
      case 'action': {
        const a = ACTION_BY_ID[ev.actionId];
        if (!a) return state;
        const o = scenario.actionResults?.[a.id];
        const text = o?.result ?? a.result;
        const sensitiveViolation = a.sensitive && !state.verified;
        return {
          ...state,
          actions: [...state.actions, a.id],
          actionResults: [...state.actionResults, { id: a.id, text }],
          account: o?.accountUpdate ? { ...state.account, ...o.accountUpdate } : state.account,
          device: o?.deviceUpdate ? { ...state.device, ...o.deviceUpdate } : state.device,
          revealed: reveal(state, o?.reveals),
          sensitiveBeforeVerify: sensitiveViolation ? [...state.sensitiveBeforeVerify, a.id] : state.sensitiveBeforeVerify,
          chat:
            a.tool === 'guide'
              ? [...state.chat, { from: 'agent', text: `[Guided step] ${a.label}` }, { from: 'requester', text }]
              : state.chat,
          log: [...state.log, { at: ev.at, kind: 'action', text: `${a.label}: ${text}` }],
        };
      }
      case 'command': {
        const res = runCommand(ev.raw, scenario, state.device, state.account, state.actions);
        if (res.clear) return { ...state, terminal: [] };
        let next: SessionState = {
          ...state,
          terminal: [...state.terminal, { cmd: ev.raw, output: res.output }],
          revealed: reveal(state, res.reveals),
          log: [...state.log, { at: ev.at, kind: 'terminal', text: `> ${ev.raw}` }],
        };
        if (res.action) {
          const o = scenario.actionResults?.[res.action];
          next = {
            ...next,
            actions: [...next.actions, res.action],
            actionResults: [...next.actionResults, { id: res.action, text: o?.result ?? ACTION_BY_ID[res.action]?.result ?? '' }],
            revealed: reveal(next, o?.reveals),
            device: o?.deviceUpdate ? { ...next.device, ...o.deviceUpdate } : next.device,
          };
        }
        return next;
      }
      case 'openTool': {
        const ids = scenario.toolReveals?.[ev.tool];
        if (!ids?.length || ids.every((id) => state.revealed.includes(id))) return state;
        return { ...state, revealed: reveal(state, ids) };
      }
      case 'viewSignInLog': {
        if (state.signInLogViewed) return state;
        return {
          ...state,
          signInLogViewed: true,
          revealed: reveal(state, scenario.signInLog?.reveals),
          log: [...state.log, { at: ev.at, kind: 'action', text: 'Reviewed sign-in log' }],
        };
      }
      case 'openKb': {
        if (state.kbOpened.includes(ev.id)) return state;
        return {
          ...state,
          kbOpened: [...state.kbOpened, ev.id],
          log: [...state.log, { at: ev.at, kind: 'kb', text: `Opened KB: ${ev.id}` }],
        };
      }
      case 'hint':
        return {
          ...state,
          hintsUsed: state.hintsUsed + 1,
          log: [...state.log, { at: ev.at, kind: 'hint', text: `Hint: ${ev.text}` }],
        };
      default:
        return state;
    }
  };
}

/** True when every alternative of a "a|b" requirement is unmet. */
export function requirementMet(req: string, actions: string[]): boolean {
  return req.split('|').some((id) => actions.includes(id));
}

function needsVerification(scenario: Scenario): boolean {
  return (
    !!scenario.socialEngineering ||
    scenario.requiredActions.some((r) => r.split('|').some((id) => ACTION_BY_ID[id]?.sensitive))
  );
}

/** Suggests the next most useful step. */
export function nextHint(scenario: Scenario, s: SessionState): string {
  if (needsVerification(scenario) && !s.verifyAttempted) {
    return 'This ticket may need account changes. Verify the requester\'s identity first (Conversation tab, "Verify identity").';
  }
  for (const factId of scenario.keyFacts) {
    if (s.revealed.includes(factId)) continue;
    const q = scenario.questions.find((x) => x.reveals?.includes(factId) && !s.asked.includes(x.id));
    if (q) return `Ask the requester: "${q.text}"`;
    if (scenario.signInLog?.reveals?.includes(factId) && !s.signInLogViewed)
      return 'Open the Directory tool and review the sign-in log.';
    const tool = (Object.keys(scenario.toolReveals ?? {}) as ('directory' | 'endpoint')[]).find((t) =>
      scenario.toolReveals?.[t]?.includes(factId),
    );
    if (tool) return `Take a close look at the ${tool === 'directory' ? 'Directory' : 'Endpoint'} tool for this user.`;
    const cmd = Object.entries(scenario.terminal ?? {}).find(([, o]) => o.reveals?.includes(factId));
    if (cmd) return `Try running \`${cmd[0]}\` in the terminal.`;
    const act = Object.entries(scenario.actionResults ?? {}).find(([, o]) => o.reveals?.includes(factId));
    if (act && ACTION_BY_ID[act[0]]) return `Try this step: ${ACTION_BY_ID[act[0]].label}.`;
  }
  for (const req of scenario.requiredActions) {
    if (!requirementMet(req, s.actions)) {
      const a = ACTION_BY_ID[req.split('|')[0]];
      if (a) return `You have enough evidence. Consider: ${a.label}.`;
    }
  }
  if (scenario.correctOutcome === 'escalate') {
    return 'You have the evidence. Think about whether tier 1 can fix this, or which team should own it.';
  }
  return 'You have what you need. Write your notes and reply, then submit the resolution.';
}
