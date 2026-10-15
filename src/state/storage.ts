import type { AppState } from '../types';

const KEY = 'tierone-state-v1';

export const DEFAULT_STATE: AppState = {
  version: 1,
  profile: null,
  settings: { theme: 'system', voice: true, voiceRate: 1, hints: true },
  tickets: [],
  calls: [],
  interviews: [],
  shifts: [],
  badges: [],
  kbRead: [],
  customScenarios: [],
  activeShift: null,
};

export function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const r = raw as Partial<AppState>;
  return {
    ...DEFAULT_STATE,
    ...r,
    version: 1,
    settings: { ...DEFAULT_STATE.settings, ...(r.settings ?? {}) },
    tickets: Array.isArray(r.tickets) ? r.tickets : [],
    calls: Array.isArray(r.calls) ? r.calls : [],
    interviews: Array.isArray(r.interviews) ? r.interviews : [],
    shifts: Array.isArray(r.shifts) ? r.shifts : [],
    badges: Array.isArray(r.badges) ? r.badges : [],
    kbRead: Array.isArray(r.kbRead) ? r.kbRead : [],
    customScenarios: Array.isArray(r.customScenarios) ? r.customScenarios : [],
    activeShift: r.activeShift ?? null,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeState(JSON.parse(raw)) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota). The app keeps working in memory.
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
