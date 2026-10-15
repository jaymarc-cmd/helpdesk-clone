import { useEffect, useState, type ReactNode } from 'react';
import { Star, StarHalf, X, type LucideIcon } from 'lucide-react';
import type { Difficulty, Priority } from '../types';

export function ProgressBar({ value, tone }: { value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 0–5 rating drawn with icons; supports halves. */
export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`} title={`${value} / 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <Star key={i} size={size} className="star on" fill="currentColor" strokeWidth={1.5} />;
        if (i === full && half)
          return (
            <span key={i} className="star-half">
              <Star size={size} className="star" strokeWidth={1.5} />
              <StarHalf size={size} className="star on" fill="currentColor" strokeWidth={1.5} />
            </span>
          );
        return <Star key={i} size={size} className="star" strokeWidth={1.5} />;
      })}
    </span>
  );
}

const PRIORITY_LABEL: Record<Priority, string> = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };

export function PriorityPill({ p, long }: { p: Priority; long?: boolean }) {
  return (
    <span className={`pill prio-${p}`} title={`${p} · ${PRIORITY_LABEL[p]}`}>
      <span className="prio-dot" aria-hidden />
      {p}
      {long && <span className="prio-long">{PRIORITY_LABEL[p]}</span>}
    </span>
  );
}

const DIFF_LABEL = ['', 'Beginner', 'Intermediate', 'Advanced'];

/** Signal-strength style difficulty meter (1–3 bars). */
export function DifficultyDots({ d, showLabel }: { d: Difficulty; showLabel?: boolean }) {
  return (
    <span className="difficulty" title={DIFF_LABEL[d]} aria-label={`Difficulty: ${DIFF_LABEL[d]}`}>
      <span className="meter" aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= d ? 'on' : ''} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {showLabel && <span className="difficulty-label">{DIFF_LABEL[d]}</span>}
    </span>
  );
}

export function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

export function ScoreRing({ score, label, size = 120 }: { score: number; label?: string; size?: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div
      className="score-ring"
      style={{ width: size, height: size, background: `conic-gradient(${color} ${score * 3.6}deg, var(--surface-3) 0)` }}
    >
      <span>
        <div className="center">
          <div className="score-value">{score}</div>
          {label && <div className="grade">{label}</div>}
        </div>
      </span>
    </div>
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {(title || onClose) && (
          <div className="modal-head">
            {title ? <h2>{title}</h2> : <span />}
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Consistent page title block: eyebrow, title, one-line description and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

/** Square tinted tile holding an icon. */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md' }: { icon: LucideIcon; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 15 : size === 'lg' ? 24 : 18;
  return (
    <span className={`icon-tile tone-${tone} size-${size}`} aria-hidden>
      <Icon size={px} strokeWidth={2} />
    </span>
  );
}

export function StatTile({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <IconTile icon={icon} tone={tone ?? 'neutral'} size="sm" />}
      </div>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

/** Stable, realistic-looking incident number for a scenario id (e.g. "INC-48213"). */
export function ticketNumber(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `INC-${(Math.abs(h) % 90000) + 10000}`;
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
