import { useEffect, useState, type ReactNode } from 'react';
import type { Difficulty, Priority } from '../types';

export function ProgressBar({ value, tone }: { value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`} title={`${value} / 5`}>
      {'★'.repeat(full)}
      {half ? '⯪' : ''}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - full - (half ? 1 : 0))}</span>
    </span>
  );
}

export function PriorityPill({ p }: { p: Priority }) {
  return <span className={`pill prio-${p}`}>{p}</span>;
}

export function DifficultyDots({ d }: { d: Difficulty }) {
  const label = ['', 'Beginner', 'Intermediate', 'Advanced'][d];
  return (
    <span className="diff small" title={label} aria-label={label}>
      {'●'.repeat(d)}
      <span style={{ opacity: 0.25 }}>{'●'.repeat(3 - d)}</span>
    </span>
  );
}

export function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

export function ScoreRing({ score, label }: { score: number; label?: string }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="score-ring" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--surface-3) 0)` }}>
      <span>
        <div className="center">
          {score}
          {label && <div className="grade">{label}</div>}
        </div>
      </span>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Tiny, safe markdown renderer for KB articles (headings, lists, bold, inline code). */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*-\s+(.*)$/);
    const num = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (line.startsWith('## ')) blocks.push(<h2 key={blocks.length}>{inline(line.slice(3))}</h2>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="md">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={out.length}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={out.length}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={out.length}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
