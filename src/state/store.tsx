import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { allScenarios, findScenario } from '../data/scenarios';
import { BADGES, newlyEarned } from '../engine/progress';
import { buildShiftReport, completeShiftTicket, createShift, tickShift } from '../engine/shift';
import type { AppState, CallAttempt, InterviewAttempt, Scenario, Settings, ShiftReport, TicketAttempt } from '../types';
import { DEFAULT_STATE, loadState, normalizeState, saveState } from './storage';

type Action =
  | { type: 'setProfile'; name: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'addTicket'; attempt: TicketAttempt }
  | { type: 'addCall'; attempt: CallAttempt }
  | { type: 'addInterview'; attempt: InterviewAttempt }
  | { type: 'kbRead'; id: string }
  | { type: 'saveScenario'; scenario: Scenario }
  | { type: 'deleteScenario'; id: string }
  | { type: 'startShift'; durationMin: number }
  | { type: 'tickShift'; now: number }
  | { type: 'endShift'; report: ShiftReport }
  | { type: 'abandonShift' }
  | { type: 'import'; state: AppState }
  | { type: 'reset' };

function withBadges(s: AppState): AppState {
  const earned = newlyEarned(s);
  if (!earned.length) return s;
  const at = new Date().toISOString();
  return { ...s, badges: [...s.badges, ...earned.map((id) => ({ id, earnedAt: at }))] };
}

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
      return withBadges({ ...state, tickets: [...state.tickets, action.attempt], activeShift });
    }
    case 'addCall':
      return withBadges({ ...state, calls: [...state.calls, action.attempt] });
    case 'addInterview':
      return withBadges({ ...state, interviews: [...state.interviews, action.attempt] });
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

interface Store {
  state: AppState;
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

  const value = useMemo<Store>(
    () => ({ state, dispatch, scenarios, getScenario, finishShift, toast, dismissToast: () => setToast(null) }),
    [state, scenarios, getScenario, finishShift, toast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
