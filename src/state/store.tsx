import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { allScenarios, findScenario } from '../data/scenarios';
import { BADGES, newlyEarned } from '../engine/progress';
import { REOPEN_AFTER_MS } from '../engine/followup';
import { buildShiftReport, completeShiftTicket, createShift, tickShift } from '../engine/shift';
import { hydrateSession, initSession, sessionReducer, type SessionEventInput, type SessionState } from '../engine/session';
import type { ActiveWork, AppState, CallAttempt, Certificate, HoldReason, KbArticle, InterviewAttempt, Scenario, Settings, ShiftReport, TicketAttempt } from '../types';
import { DEFAULT_STATE, loadState, normalizeState, saveState } from './storage';

type Action =
  | { type: 'setProfile'; name: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'addTicket'; attempt: TicketAttempt }
  | { type: 'addCall'; attempt: CallAttempt }
  | { type: 'addInterview'; attempt: InterviewAttempt }
  | { type: 'kbRead'; id: string }
  | { type: 'addKb'; article: KbArticle }
  | { type: 'startExam'; scenarioIds: string[] }
  | { type: 'endExam'; certificate?: Certificate }
  | { type: 'saveScenario'; scenario: Scenario }
  | { type: 'deleteScenario'; id: string }
  | { type: 'startShift'; durationMin: number }
  | { type: 'tickShift'; now: number }
  | { type: 'endShift'; report: ShiftReport }
  | { type: 'abandonShift' }
  | { type: 'startWork'; scenarioId: string; mode: 'practice' | 'shift' | 'exam'; now: number; reopen?: { attemptId: string; ticket: string } }
  | { type: 'workEvent'; event: SessionEventInput; now: number; scenarioId?: string }
  | { type: 'releaseWork'; scenarioId?: string }
  | { type: 'focusWork'; scenarioId: string }
  | { type: 'holdWork'; scenarioId: string; reason: HoldReason; now: number }
  | { type: 'resumeWork'; scenarioId: string; now: number; byUser?: boolean }
  | { type: 'import'; state: AppState }
  | { type: 'reset' };

function withBadges(s: AppState): AppState {
  const earned = newlyEarned(s);
  if (!earned.length) return s;
  const at = new Date().toISOString();
  return { ...s, badges: [...s.badges, ...earned.map((id) => ({ id, earnedAt: at }))] };
}

/** How many tickets an analyst can have open at once. */
export const MAX_OPEN_TICKETS = 3;

/** Seconds the requester takes to come back to a ticket put on hold for them. */
const USER_RETURN_MS = 50_000;

const focusedId = (state: AppState, id?: string) => id ?? state.focusedWork ?? state.works[0]?.scenarioId;

/** Applies a session event to one open ticket. Handling time excludes time on hold. */
function applyWorkEvent(state: AppState, scenarioId: string | undefined, event: SessionEventInput, now: number): AppState {
  const id = focusedId(state, scenarioId);
  const w = state.works.find((x) => x.scenarioId === id);
  if (!w) return state;
  const sc = findScenario(w.scenarioId, state.customScenarios);
  if (!sc) return { ...state, works: state.works.filter((x) => x !== w) };
  const at = Math.max(0, Math.round((now - w.startedAt - (w.pausedMs ?? 0)) / 1000));
  const session = sessionReducer(sc)(hydrateSession(w.session, sc), { ...event, at } as Parameters<ReturnType<typeof sessionReducer>>[1]);
  return { ...state, works: state.works.map((x) => (x === w ? { ...w, session } : x)) };
}

const withoutWork = (state: AppState, id: string): Pick<AppState, 'works' | 'focusedWork'> => {
  const works = state.works.filter((w) => w.scenarioId !== id);
  return { works, focusedWork: state.focusedWork === id ? (works.find((w) => !w.hold)?.scenarioId ?? works[0]?.scenarioId ?? null) : state.focusedWork };
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { name: action.name.trim() || 'Analyst', createdAt: state.profile?.createdAt ?? new Date().toISOString() } };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'addTicket': {
      let activeShift = state.activeShift;
      if (activeShift && action.attempt.mode === 'shift') {
        const sc = findScenario(action.attempt.scenarioId, state.customScenarios);
        if (sc) activeShift = completeShiftTicket(activeShift, sc, action.attempt);
      }
      const a = action.attempt;
      // A resolution that will not hold comes back later; working a reopened ticket clears it.
      const reopens = [
        ...state.reopens.filter((r) => r.attemptId !== a.reopenOf),
        ...(a.reopenReason ? [{ attemptId: a.id, scenarioId: a.scenarioId, dueAt: Date.now() + REOPEN_AFTER_MS, reason: a.reopenReason }] : []),
      ];
      // Exam tickets are recorded against the exam in progress.
      const exam =
        state.exam && a.mode === 'exam' && state.exam.scenarioIds.includes(a.scenarioId) && !state.exam.attempts[a.scenarioId]
          ? { ...state.exam, attempts: { ...state.exam.attempts, [a.scenarioId]: a.id } }
          : state.exam;
      return withBadges({ ...state, tickets: [...state.tickets, a], activeShift, reopens, exam, ...withoutWork(state, a.scenarioId) });
    }
    case 'startWork': {
      const sc = findScenario(action.scenarioId, state.customScenarios);
      if (!sc) return state;
      if (state.works.some((w) => w.scenarioId === sc.id)) return { ...state, focusedWork: sc.id };
      if (state.works.length >= MAX_OPEN_TICKETS) return state;
      const fresh = initSession(sc);
      const session = action.reopen ? sessionReducer(sc)(fresh, { type: 'reopen', attemptId: action.reopen.attemptId, ticket: action.reopen.ticket, at: 0 }) : fresh;
      const work: ActiveWork = { scenarioId: sc.id, mode: action.mode, startedAt: action.now, session };
      return { ...state, works: [...state.works, work], focusedWork: sc.id };
    }
    case 'workEvent':
      return applyWorkEvent(state, action.scenarioId, action.event, action.now);
    case 'releaseWork': {
      const id = focusedId(state, action.scenarioId);
      return id ? { ...state, ...withoutWork(state, id) } : state;
    }
    case 'focusWork':
      return state.works.some((w) => w.scenarioId === action.scenarioId) ? { ...state, focusedWork: action.scenarioId } : state;
    case 'holdWork': {
      const w = state.works.find((x) => x.scenarioId === action.scenarioId);
      if (!w || w.hold) return state;
      const held = applyWorkEvent(state, w.scenarioId, { type: 'hold', reason: action.reason }, action.now);
      return {
        ...held,
        works: held.works.map((x) =>
          x.scenarioId === w.scenarioId
            ? { ...x, hold: { reason: action.reason, since: action.now, replyAt: action.reason === 'Awaiting user' ? action.now + USER_RETURN_MS : undefined } }
            : x,
        ),
      };
    }
    case 'resumeWork': {
      const w = state.works.find((x) => x.scenarioId === action.scenarioId);
      if (!w?.hold) return state;
      const resumed = { ...state, works: state.works.map((x) => (x === w ? { ...w, hold: undefined, pausedMs: (w.pausedMs ?? 0) + (action.now - w.hold!.since) } : x)) };
      return applyWorkEvent(resumed, w.scenarioId, { type: 'resume', byUser: !!action.byUser, reason: w.hold.reason }, action.now);
    }
    case 'addCall':
      return withBadges({ ...state, calls: [...state.calls, action.attempt] });
    case 'addInterview':
      return withBadges({ ...state, interviews: [...state.interviews, action.attempt] });
    case 'startExam':
      return { ...state, exam: { id: `exam-${Date.now().toString(36)}`, startedAt: new Date().toISOString(), scenarioIds: action.scenarioIds, attempts: {} } };
    case 'endExam': {
      // Exam tickets still open are dropped with the exam.
      const ids = state.exam?.scenarioIds ?? [];
      const works = state.works.filter((w) => !(w.mode === 'exam' && ids.includes(w.scenarioId)));
      return withBadges({
        ...state,
        exam: null,
        works,
        focusedWork: works.some((w) => w.scenarioId === state.focusedWork) ? state.focusedWork : (works[0]?.scenarioId ?? null),
        certificates: action.certificate ? [...state.certificates, action.certificate] : state.certificates,
      });
    }
    case 'addKb':
      return withBadges({ ...state, customKb: [...state.customKb.filter((a) => a.id !== action.article.id), action.article] });
    case 'kbRead':
      if (state.kbRead.includes(action.id)) return state;
      return withBadges({ ...state, kbRead: [...state.kbRead, action.id] });
    case 'saveScenario': {
      const others = state.customScenarios.filter((s) => s.id !== action.scenario.id);
      return withBadges({ ...state, customScenarios: [...others, { ...action.scenario, custom: true }] });
    }
    case 'deleteScenario':
      return { ...state, customScenarios: state.customScenarios.filter((s) => s.id !== action.id) };
    case 'startShift':
      return { ...state, activeShift: createShift(allScenarios(state.customScenarios), action.durationMin) };
    case 'tickShift': {
      if (!state.activeShift) return state;
      const next = tickShift(state.activeShift, action.now);
      return next === state.activeShift ? state : { ...state, activeShift: next };
    }
    case 'endShift':
      return withBadges({ ...state, activeShift: null, shifts: [...state.shifts, action.report] });
    case 'abandonShift':
      return { ...state, activeShift: null };
    case 'import':
      return normalizeState(action.state);
    case 'reset':
      return { ...DEFAULT_STATE, profile: state.profile, settings: state.settings };
    default:
      return state;
  }
}

export interface Work {
  scenario: Scenario;
  session: SessionState;
  mode: 'practice' | 'shift' | 'exam';
  /** When the ticket was assigned, shifted by time spent on hold. */
  startedAt: number;
  hold?: ActiveWork['hold'];
  /** Sends an event to the active ticket's session; the timestamp is added for you. */
  emit: (event: SessionEventInput) => void;
}

interface Store {
  state: AppState;
  /** The ticket the workstation apps act on (the focused one), or null. */
  work: Work | null;
  /** Every ticket assigned to the analyst. */
  works: Work[];
  dispatch: (a: Action) => void;
  scenarios: Scenario[];
  getScenario: (id: string) => Scenario | undefined;
  finishShift: () => ShiftReport | null;
  toast: { id: number; text: string; icon: string } | null;
  dismissToast: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [toast, setToast] = useState<Store['toast']>(null);
  const seenBadges = useRef(state.badges.length);

  useEffect(() => saveState(state), [state]);

  // Celebrate newly earned badges.
  useEffect(() => {
    if (state.badges.length > seenBadges.current) {
      const latest = state.badges[state.badges.length - 1];
      const def = BADGES.find((b) => b.id === latest.id);
      if (def) setToast({ id: Date.now(), text: `Badge earned: ${def.name}`, icon: def.icon });
    }
    seenBadges.current = state.badges.length;
  }, [state.badges]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // Shift clock: deliver new tickets while a shift is running.
  useEffect(() => {
    if (!state.activeShift) return;
    const t = setInterval(() => dispatch({ type: 'tickShift', now: Date.now() }), 1000);
    return () => clearInterval(t);
  }, [state.activeShift]);

  const scenarios = useMemo(() => allScenarios(state.customScenarios), [state.customScenarios]);
  const getScenario = useCallback((id: string) => findScenario(id, state.customScenarios), [state.customScenarios]);

  const finishShift = useCallback(() => {
    if (!state.activeShift) return null;
    const report = buildShiftReport(state.activeShift, state.tickets, getScenario);
    dispatch({ type: 'endShift', report });
    return report;
  }, [state.activeShift, state.tickets, getScenario]);

  // Tickets on hold for the user come back when the user replies.
  const due = state.works.filter((w) => w.hold?.replyAt).map((w) => [w.scenarioId, w.hold!.replyAt!] as const);
  const dueKey = due.map((d) => d.join(':')).join(',');
  useEffect(() => {
    if (!due.length) return;
    const t = setInterval(() => {
      for (const [id, at] of due) if (Date.now() >= at) dispatch({ type: 'resumeWork', scenarioId: id, now: Date.now(), byUser: true });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueKey]);

  const works = useMemo<Work[]>(
    () =>
      state.works.flatMap((w) => {
        const scenario = findScenario(w.scenarioId, state.customScenarios);
        if (!scenario) return [];
        return [
          {
            scenario,
            session: hydrateSession(w.session, scenario),
            mode: w.mode,
            startedAt: w.startedAt + (w.pausedMs ?? 0),
            hold: w.hold,
            emit: (event: SessionEventInput) => dispatch({ type: 'workEvent', event, now: Date.now(), scenarioId: w.scenarioId }),
          },
        ];
      }),
    [state.works, state.customScenarios],
  );
  const work = works.find((w) => w.scenario.id === state.focusedWork) ?? works[0] ?? null;

  const value = useMemo<Store>(
    () => ({ state, work, works, dispatch, scenarios, getScenario, finishShift, toast, dismissToast: () => setToast(null) }),
    [state, work, works, scenarios, getScenario, finishShift, toast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
