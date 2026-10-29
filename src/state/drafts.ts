import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

/**
 * Unsent text per open ticket: the reply box and the resolve form. Kept in the browser so checking something
 * in another app, closing the resolve dialog or reloading the page never throws away what was typed.
 */
const KEY = 'tierone-drafts-v1';

type Drafts = Record<string, Record<string, unknown>>;

function read(): Drafts {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as Drafts) : {};
  } catch {
    return {};
  }
}

function write(d: Drafts) {
  try {
    if (Object.keys(d).length) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: drafts just don't survive a reload.
  }
}

const isEmpty = (v: unknown) =>
  v === undefined || v === '' || (typeof v === 'object' && v !== null && Object.values(v).every((x) => x === undefined || x === ''));

export function saveDraft(ticket: string, field: string, value: unknown) {
  const d = read();
  const t = { ...(d[ticket] ?? {}) };
  if (isEmpty(value)) delete t[field];
  else t[field] = value;
  if (Object.keys(t).length) d[ticket] = t;
  else delete d[ticket];
  write(d);
}

export function clearDrafts(ticket: string) {
  const d = read();
  if (!(ticket in d)) return;
  delete d[ticket];
  write(d);
}

/** Drops drafts for tickets that are no longer open (resolved, released, abandoned). */
export function pruneDrafts(openTickets: string[]) {
  const d = read();
  const keep = new Set(openTickets);
  const stale = Object.keys(d).filter((k) => !keep.has(k));
  if (!stale.length) return;
  for (const k of stale) delete d[k];
  write(d);
}

/**
 * useState that remembers its value for this ticket until the ticket is closed. Only what the person changes is
 * kept, so a computed starting value (notes gathered from the chat) stays fresh until they edit it.
 */
export function useDraft<T>(ticket: string, field: string, initial: T) {
  const [value, setValue] = useState<T>(() => (read()[ticket]?.[field] as T | undefined) ?? initial);
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) saveDraft(ticket, field, value);
  }, [ticket, field, value]);
  const set = useCallback((v: SetStateAction<T>) => {
    touched.current = true;
    setValue(v);
  }, []);
  return [value, set] as const;
}
