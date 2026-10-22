import { ACTION_BY_ID, actionApp, actionLabel, parseGroupAction } from '../data/actions';
import { applyServerOp, parseServerAction, serversFor } from '../data/servers';
import type { AccountState, DeviceState, Question, RevealTool, Scenario, ServerState, WorkLogEntry } from '../types';
import { runCommand } from './terminal';
import { HOLD_GRACE_SEC, MAX_NUDGES, NUDGE_AFTER_SEC, intentsOf, line, nudgeLine, startingPatience, toneFor, type Intent } from './chat';

export const VERIFY_QUESTION_ID = '__verify';

export interface ChatMessage {
  /** `note` is an internal work note: shown to the analyst only, never sent to the requester. */
  from: 'agent' | 'requester' | 'system' | 'note';
  text: string;
  /** Seconds since the ticket was assigned. */
  at?: number;
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
  /** How the requester feels, 0-100. Silence, surprises and bad questions lower it; courtesy raises it. */
  patience: number;
  /** Times the requester chased for an update. */
  nudges: number;
  /** The analyst said they were checking something; the requester waits quietly until this time. */
  holdUntil: number;
  /** Things the analyst told the requester before doing them ('remote', 'restart'). */
  announced: string[];
  /** Things done to the requester's device without warning them first. */
  unannounced: string[];
  greeted: boolean;
  empathyShown: number;
  /** The requester has seen the remote-session notice on their screen. */
  remoteNoticed: boolean;
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
  | { type: 'hint'; text: string; at: number }
  /** Time passing: the requester may chase if they have been left waiting. */
  | { type: 'nudge'; at: number }
  /** An internal work note. */
  | { type: 'note'; text: string; at: number };

/** Distributes Omit across the union so each event keeps its own fields. */
export type SessionEventInput = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, 'at'> : never) : never;

export function initSession(scenario: Scenario): SessionState {
  return {
    account: structuredClone(scenario.account),
    device: structuredClone(scenario.device),
    servers: serversFor(scenario),
    asked: [],
    chat: [{ from: 'requester', text: scenario.description, at: 0 }],
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
    patience: startingPatience(scenario),
    nudges: 0,
    holdUntil: 0,
    announced: [],
    unannounced: [],
    greeted: false,
    empathyShown: 0,
    remoteNoticed: false,
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

const clampPatience = (n: number) => Math.max(0, Math.min(100, n));

/** When the conversation last moved (agent or requester), in seconds. */
export function lastChatAt(s: SessionState): number {
  for (let i = s.chat.length - 1; i >= 0; i--) {
    const m = s.chat[i];
    if (m.from === 'agent' || m.from === 'requester') return m.at ?? 0;
  }
  return 0;
}

/** Seconds of quiet the requester tolerates from `lastChatAt` before chasing. */
export function quietAllowance(s: SessionState): number {
  const last = lastChatAt(s);
  return s.holdUntil > last ? Math.max(NUDGE_AFTER_SEC, s.holdUntil - last) : NUDGE_AFTER_SEC;
}

export function sessionReducer(scenario: Scenario) {
  const inner = innerReducer(scenario);
  return (state: SessionState, ev: SessionEvent): SessionState => {
    const next = inner(state, ev);
    if (next === state || next.chat.length <= state.chat.length) return next;
    const chat = next.chat.map((m, i) => (i >= state.chat.length && m.at === undefined ? { ...m, at: ev.at } : m));
    return { ...next, chat };
  };
}

/** Courtesy and expectation-setting in what the analyst typed. */
function applyEtiquette(state: SessionState, it: Set<Intent>, at: number): SessionState {
  let patience = state.patience;
  if (it.has('greeting') && !state.greeted) patience += 3;
  if (it.has('empathy') && state.empathyShown < 2) patience += 5;
  if (it.has('update')) patience += 4;
  const announced = [...state.announced];
  if (it.has('remote') && !announced.includes('remote')) announced.push('remote');
  if (it.has('restartWarn') && !announced.includes('restart')) announced.push('restart');
  return {
    ...state,
    patience: clampPatience(patience),
    greeted: state.greeted || it.has('greeting'),
    empathyShown: state.empathyShown + (it.has('empathy') ? 1 : 0),
    holdUntil: it.has('hold') ? at + HOLD_GRACE_SEC : state.holdUntil,
    announced,
  };
}

function innerReducer(scenario: Scenario) {
  return (state: SessionState, ev: SessionEvent): SessionState => {
    const firstName = scenario.requester.name.split(' ')[0];
    const tone = () => toneFor(scenario, state.patience);
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
          return innerReducer(scenario)(state, { type: 'verify', at: ev.at });
        }
        const it = intentsOf(text);
        const seed = state.chat.length;
        let next = applyEtiquette(state, it, ev.at);
        next = { ...next, chat: [...next.chat, { from: 'agent', text, at: ev.at }] };
        const t = toneFor(scenario, next.patience);

        // "Could you restart your laptop?" is the guided restart, worded by the analyst.
        if (it.has('restartRequest') && ACTION_BY_ID.guide_restart && !state.actions.includes('guide_restart')) {
          const acted = doAction(scenario, next, 'guide_restart', ev.at, false);
          return { ...acted, log: [...next.log, { at: ev.at, kind: 'question', text: `Said: ${text}` }, ...acted.log.slice(next.log.length)] };
        }

        const q = matchQuestion(scenario, text, state.asked);
        if (q) {
          const hello = it.has('greeting') && !state.greeted && t !== 'annoyed' ? 'Hi! ' : '';
          return {
            ...next,
            patience: clampPatience(next.patience - (q.quality === 'bad' ? 15 : 0)),
            asked: [...next.asked, q.id],
            chat: [...next.chat, { from: 'requester', text: hello + q.reply }],
            revealed: reveal(next, q.reveals),
            log: [...next.log, { at: ev.at, kind: 'question', text: `Asked: ${text}` }],
          };
        }
        return {
          ...next,
          chat: [...next.chat, { from: 'requester', text: smallTalk(scenario, next, it, text, seed) }],
          log: [...next.log, { at: ev.at, kind: 'question', text: `Said: ${text}` }],
        };
      }
      case 'note': {
        const text = ev.text.trim();
        if (!text) return state;
        return {
          ...state,
          chat: [...state.chat, { from: 'note', text, at: ev.at }],
          log: [...state.log, { at: ev.at, kind: 'note', text: `Work note: ${text}` }],
        };
      }
      case 'nudge': {
        if (state.nudges >= MAX_NUDGES || state.confirmed) return state;
        if (ev.at - lastChatAt(state) < quietAllowance(state)) return state;
        const text = nudgeLine(scenario, state.nudges, tone());
        return {
          ...state,
          nudges: state.nudges + 1,
          patience: clampPatience(state.patience - 10),
          chat: [...state.chat, { from: 'requester', text }],
          log: [...state.log, { at: ev.at, kind: 'system', text: `${firstName} chased for an update` }],
        };
      }
      case 'action':
        return doAction(scenario, state, ev.actionId, ev.at, true);
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
        let next = state;
        // Connecting to a live device puts a notice on the user's screen.
        if (ev.tool === 'endpoint' && state.device.online && !state.remoteNoticed) {
          const told = state.announced.includes('remote');
          next = {
            ...next,
            remoteNoticed: true,
            patience: clampPatience(next.patience - (told ? 0 : 10)),
            unannounced: told ? next.unannounced : [...next.unannounced, 'remote'],
            chat: [
              ...next.chat,
              {
                from: 'requester',
                text: told
                  ? 'Okay, I can see a notice that you are connected to my computer now.'
                  : 'Wait, a box just popped up saying someone is connecting to my computer. Is that you?',
              },
            ],
          };
        }
        const ids = scenario.toolReveals?.[ev.tool];
        if (!ids?.length || ids.every((id) => next.revealed.includes(id))) return next;
        return { ...next, revealed: reveal(next, ids) };
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
          chat: [
            ...state.chat,
            {
              from: 'agent',
              text: [`Could you check whether it's working for you now, ${firstName}?`, `Can you try it again for me now, ${firstName}?`, `Could you give it another try and let me know if it works?`][
                state.confirmAttempts % 3
              ],
            },
            { from: 'requester', text: reply },
          ],
          patience: clampPatience(state.patience + (fixed ? 10 : -3)),
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

/** Performs an action. `agentLine` adds the canned "[Guided step]" message for guided steps picked from the list. */
function doAction(scenario: Scenario, state: SessionState, id: string, at: number, agentLine: boolean): SessionState {
  const catalog = ACTION_BY_ID[id];
  if (!catalog && !parseGroupAction(id) && !parseServerAction(id)) return state;
  const applied = applyAction(state, id);
  let next = applied.state;
  const o = scenario.actionResults?.[id];
  const text = o?.result ?? applied.text;
  const sensitiveViolation = !!catalog?.sensitive && !state.verified;
  const chat: ChatMessage[] = [...next.chat];
  if (catalog?.tool === 'guide') {
    if (agentLine) chat.push({ from: 'agent', text: `[Guided step] ${catalog.label}` });
    chat.push({ from: 'requester', text });
  }
  let patience = next.patience;
  let unannounced = next.unannounced;
  // A forced restart is felt immediately on the other end.
  if (id === 'remote_restart' && state.device.online) {
    const told = state.announced.includes('restart');
    chat.push({
      from: 'requester',
      text: told
        ? 'Okay, it is restarting now.'
        : "Whoa, my laptop just restarted on its own! I hadn't saved what I was working on. Was that you?",
    });
    if (!told) {
      patience -= 15;
      unannounced = [...unannounced, 'restart'];
    }
  }
  next = {
    ...next,
    patience: clampPatience(patience),
    unannounced,
    chat,
    actions: [...next.actions, id],
    actionResults: [...next.actionResults, { id, text }],
    account: o?.accountUpdate ? { ...next.account, ...o.accountUpdate } : next.account,
    device: o?.deviceUpdate ? { ...next.device, ...o.deviceUpdate } : next.device,
    revealed: reveal(next, o?.reveals),
    sensitiveBeforeVerify: sensitiveViolation ? [...next.sensitiveBeforeVerify, id] : next.sensitiveBeforeVerify,
    log: [...next.log, { at, kind: 'action', text: `${actionLabel(id)}: ${text}` }],
  };
  return next;
}

/** The requester's answer to anything that is not one of the scenario's questions. */
function smallTalk(scenario: Scenario, s: SessionState, it: Set<Intent>, text: string, seed: number): string {
  const t = toneFor(scenario, s.patience);
  if (it.has('checkin')) return line('checkin', t, seed);
  if (it.has('closing')) {
    if (scenario.correctOutcome !== 'resolve') return 'Okay. So someone else will pick this up? Please keep me posted.';
    return line(allRequirementsMet(scenario, s.actions) && s.confirmed ? 'closingFixed' : 'closingBroken', t, seed);
  }
  if (it.has('remote')) return line('remote', t, seed);
  if (it.has('restartWarn')) return line('restartWarn', t, seed);
  if (it.has('hold')) return line('hold', t, seed);
  if (it.has('update')) return line('update', t, seed);
  if (it.has('greeting')) return line('greeting', t, seed);
  if (it.has('empathy')) return line('empathy', t, seed);
  if (it.has('thanks')) return line('thanks', t, seed);
  return line(/\?\s*$/.test(text) ? 'question' : 'statement', t, seed);
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
