import { ACTION_BY_ID, actionApp, actionLabel, parseGroupAction } from '../data/actions';
import { applyServerOp, parseServerAction, serversFor } from '../data/servers';
import type { AccountState, DeviceState, Question, RevealTool, Scenario, ServerState, WorkLogEntry } from '../types';
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
  /** Shared infrastructure as it stands on this ticket (Server room). */
  servers: ServerState[];
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
  /** The requester confirmed the fix works. */
  confirmed: boolean;
  confirmAttempts: number;
  log: WorkLogEntry[];
  hintsUsed: number;
}

export type SessionEvent =
  | { type: 'ask'; questionId: string; at: number }
  | { type: 'say'; text: string; at: number }
  | { type: 'verify'; at: number }
  | { type: 'action'; actionId: string; at: number }
  | { type: 'command'; raw: string; at: number }
  | { type: 'openTool'; tool: RevealTool; at: number }
  | { type: 'viewSignInLog'; at: number }
  | { type: 'openKb'; id: string; at: number }
  | { type: 'confirm'; at: number }
  | { type: 'hint'; text: string; at: number };

/** Distributes Omit across the union so each event keeps its own fields. */
export type SessionEventInput = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, 'at'> : never) : never;

export function initSession(scenario: Scenario): SessionState {
  return {
    account: structuredClone(scenario.account),
    device: structuredClone(scenario.device),
    servers: serversFor(scenario),
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
    confirmed: false,
    confirmAttempts: 0,
    log: [{ at: 0, kind: 'system', text: `Ticket assigned to you (${scenario.channel}, ${scenario.priority})` }],
    hintsUsed: 0,
  };
}

/** Older saved sessions may predate newer fields; fill them in. */
export function hydrateSession(raw: unknown, scenario: Scenario): SessionState {
  const base = initSession(scenario);
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...(raw as Partial<SessionState>) };
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

/** True when any alternative of an "a|b" requirement was performed. */
export function requirementMet(req: string, actions: string[]): boolean {
  return req.split('|').some((id) => actions.includes(id));
}

export function allRequirementsMet(scenario: Scenario, actions: string[]): boolean {
  return scenario.requiredActions.every((r) => requirementMet(r, actions));
}

/** Applies an action's built-in effect (catalog, group change or server op). Returns new state and default text. */
function applyAction(state: SessionState, id: string): { state: SessionState; text: string } {
  const g = parseGroupAction(id);
  if (g) {
    const has = state.account.groups.includes(g.group);
    const groups = g.op === 'add' ? (has ? state.account.groups : [...state.account.groups, g.group]) : state.account.groups.filter((x) => x !== g.group);
    const text =
      g.op === 'add'
        ? has
          ? `${state.account.username} is already a member of ${g.group}.`
          : `Added ${state.account.username} to ${g.group}. The change applies at the user's next sign-in.`
        : has
          ? `Removed ${state.account.username} from ${g.group}.`
          : `${state.account.username} is not a member of ${g.group}.`;
    return { state: { ...state, account: { ...state.account, groups } }, text };
  }
  const srv = parseServerAction(id);
  if (srv) {
    const r = applyServerOp(state.servers, srv);
    return { state: { ...state, servers: r.servers }, text: r.result };
  }
  return { state, text: ACTION_BY_ID[id]?.result ?? 'Done.' };
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
                ? `Identity verified: details match the directory record for ${scenario.accountOwner?.name ?? scenario.requester.name}.`
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
            { from: 'requester', text: `Sorry, I'm not sure what you mean. Could you ask that another way?` },
          ],
          log: [...state.log, { at: ev.at, kind: 'question', text: `Said: ${text}` }],
        };
      }
      case 'action': {
        const id = ev.actionId;
        const catalog = ACTION_BY_ID[id];
        if (!catalog && !parseGroupAction(id) && !parseServerAction(id)) return state;
        const applied = applyAction(state, id);
        let next = applied.state;
        const o = scenario.actionResults?.[id];
        const text = o?.result ?? applied.text;
        const sensitiveViolation = !!catalog?.sensitive && !state.verified;
        next = {
          ...next,
          actions: [...next.actions, id],
          actionResults: [...next.actionResults, { id, text }],
          account: o?.accountUpdate ? { ...next.account, ...o.accountUpdate } : next.account,
          device: o?.deviceUpdate ? { ...next.device, ...o.deviceUpdate } : next.device,
          revealed: reveal(next, o?.reveals),
          sensitiveBeforeVerify: sensitiveViolation ? [...next.sensitiveBeforeVerify, id] : next.sensitiveBeforeVerify,
          chat:
            catalog?.tool === 'guide'
              ? [...next.chat, { from: 'agent', text: `[Guided step] ${catalog.label}` }, { from: 'requester', text }]
              : next.chat,
          log: [...next.log, { at: ev.at, kind: 'action', text: `${actionLabel(id)}: ${text}` }],
        };
        return next;
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
      case 'confirm': {
        const fixed = scenario.correctOutcome === 'resolve' && allRequirementsMet(scenario, state.actions);
        const reply =
          scenario.correctOutcome !== 'resolve'
            ? `I understand. So someone else needs to look at this? Please keep me posted.`
            : fixed
              ? `Yes, that's working now. Thanks for your help!`
              : `No, sorry, it's still not working on my side.`;
        return {
          ...state,
          confirmed: state.confirmed || fixed,
          confirmAttempts: state.confirmAttempts + 1,
          chat: [...state.chat, { from: 'agent', text: `Could you check whether it's working for you now, ${firstName}?` }, { from: 'requester', text: reply }],
          log: [...state.log, { at: ev.at, kind: 'question', text: fixed ? 'User confirmed the fix' : 'Asked user to confirm the fix (not fixed yet)' }],
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

function needsVerification(scenario: Scenario): boolean {
  return (
    !!scenario.socialEngineering ||
    scenario.requiredActions.some((r) => r.split('|').some((id) => ACTION_BY_ID[id]?.sensitive))
  );
}

/** Suggests the next most useful step, naming the app to use. */
export function nextHint(scenario: Scenario, s: SessionState): string {
  const user = scenario.account.username;
  const host = scenario.device.hostname;
  if (needsVerification(scenario) && !s.verifyAttempted) {
    return 'This ticket may need account changes. Verify the requester first with "Verify identity" in the ticket conversation.';
  }
  for (const factId of scenario.keyFacts) {
    if (s.revealed.includes(factId)) continue;
    const q = scenario.questions.find((x) => x.reveals?.includes(factId) && !s.asked.includes(x.id));
    if (q) return `Ask the requester: "${q.text}"`;
    if (scenario.signInLog?.reveals?.includes(factId) && !s.signInLogViewed)
      return `Open Directory, find ${user} and check the Sign-in log tab.`;
    if (scenario.toolReveals?.servers?.includes(factId)) return 'Check the Server room for problems with shared infrastructure.';
    if (scenario.toolReveals?.directory?.includes(factId)) return `Open ${user} in Directory and review the account.`;
    if (scenario.toolReveals?.endpoint?.includes(factId)) return `Connect to ${host} in Remote desktop and check its health and inventory.`;
    const cmd = Object.entries(scenario.terminal ?? {}).find(([, o]) => o.reveals?.includes(factId));
    if (cmd) return `In Remote desktop, connect to ${host} and run \`${cmd[0]}\` in the terminal.`;
    const act = Object.entries(scenario.actionResults ?? {}).find(([, o]) => o.reveals?.includes(factId));
    if (act) return `Try this in ${actionApp(act[0])}: ${actionLabel(act[0])}.`;
  }
  for (const req of scenario.requiredActions) {
    if (!requirementMet(req, s.actions)) {
      const id = req.split('|')[0];
      return `You have enough evidence. Next, in ${actionApp(id)}: ${actionLabel(id)}.`;
    }
  }
  if (scenario.correctOutcome === 'escalate') {
    return 'You have the evidence. Think about whether tier 1 can fix this, or which team should own it, then resolve the ticket.';
  }
  if (!s.confirmed) return 'Ask the requester to confirm the fix works ("Confirm fix" in the ticket), then resolve the ticket.';
  return 'You have what you need. Resolve the ticket with your notes and a reply to the requester.';
}
