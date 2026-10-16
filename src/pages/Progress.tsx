import { Link } from 'react-router-dom';
import {
  Activity,
  CircleCheck,
  Clock,
  FileText,
  Inbox,
  Lock,
  MessagesSquare,
  Printer,
  ScanSearch,
  ShieldCheck,
  Stethoscope,
  Target,
  Wrench,
  type LucideIcon,
  Crosshair,
} from 'lucide-react';
import { BADGES, RANKS, categoryStats, overallStats, rankFor, totalXp } from '../engine/progress';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { useStore } from '../state/store';
import { CATEGORIES } from '../types';
import { BadgeGlyph, CategoryIcon } from '../components/icons';
import {
  CategoryPill,
  EmptyState,
  ModePill,
  PageHeader,
  ProgressBar,
  StatTile,
  Stars,
  formatClock,
  formatDateTime,
  scoreTone,
  ticketNumber,
  timeAgo,
} from '../components/ui';
import '../styles/progress-builder-settings.css';

const SECTIONS = [
  { key: 'diagnosis', label: 'Diagnosis', icon: Stethoscope },
  { key: 'investigation', label: 'Investigation', icon: ScanSearch },
  { key: 'resolution', label: 'Resolution', icon: Wrench },
  { key: 'process', label: 'Process & security', icon: ShieldCheck },
  { key: 'communication', label: 'Communication', icon: MessagesSquare },
  { key: 'documentation', label: 'Documentation', icon: FileText },
  { key: 'time', label: 'Handling time', icon: Clock },
] as const satisfies readonly { key: string; label: string; icon: LucideIcon }[];

type SectionKey = (typeof SECTIONS)[number]['key'];

const fmt = (n: number) => n.toLocaleString('en-US');

const SCORE_LABEL: Record<'success' | 'warning' | 'danger', string> = {
  success: 'On target',
  warning: 'Getting there',
  danger: 'Needs work',
};

const FOCUS_TIP: Record<SectionKey, string> = {
  communication: 'Greet by name, show empathy, explain plainly, and close with next steps.',
  documentation: 'Write notes in this order: symptom, findings, cause, actions, result.',
  process: 'Verify identity before sensitive changes and avoid shotgun troubleshooting.',
  investigation: 'Ask more questions and use the tools before deciding on a fix.',
  diagnosis: 'Gather evidence until one root cause clearly fits all the facts.',
  resolution: 'Check whether a ticket belongs with another team, and complete every fix step.',
  time: 'Use shift mode to practise working efficiently under SLA pressure.',
};

export function ProgressPage() {
  const { state } = useStore();
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const stats = overallStats(state);
  const cats = categoryStats(state);
  const earned = new Map(state.badges.map((b) => [b.id, b.earnedAt]));
  const hasTickets = state.tickets.length > 0;

  // Section averages across all attempts reveal skill gaps.
  const sectionAvg = (key: string) => {
    const xs = state.tickets.map((t) => {
      const s = t.result.sections.find((x) => x.key === key)!;
      return s.score / s.max;
    });
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const avgs = Object.fromEntries(SECTIONS.map((s) => [s.key, sectionAvg(s.key)])) as Record<SectionKey, number>;
  const weakest = hasTickets ? [...SECTIONS].sort((a, b) => avgs[a.key] - avgs[b.key])[0] : null;

  const scoreState = scoreTone(stats.avgScore);
  const badgeCount = state.badges.length;
  const ranksReached = RANKS.filter((r) => xp >= r.xp).length;
  const catTotals = CATEGORIES.reduce(
    (acc, c) => ({ passed: acc.passed + cats[c].completed, total: acc.total + cats[c].total }),
    { passed: 0, total: 0 },
  );

  return (
    <div className="page pbs-page pbs-progress">
      <PageHeader
        title="Your progress"
        description={`${state.profile?.name ? `${state.profile.name} · ` : ''}Level ${rank.level} · ${rank.current.title}`}
        actions={
          <button type="button" className="btn print-btn no-print" onClick={() => window.print()}>
            <Printer size={16} aria-hidden />
            Print training record
          </button>
        }
      />

      <section className="card stat-strip" aria-label="Summary">
        <StatTile
          label="Total XP"
          value={fmt(xp)}
          sub={rank.next ? `${fmt(rank.next.xp - xp)} XP to ${rank.next.title}` : 'Top rank reached'}
        />
        <StatTile
          label="Tickets closed"
          value={stats.tickets}
          sub={`${catTotals.passed} of ${BUILTIN_SCENARIOS.length} scenarios passed`}
        />
        <StatTile
          label="Average score"
          value={
            hasTickets ? (
              <>
                {stats.avgScore}
                <span className="faint">/100</span>
              </>
            ) : (
              '–'
            )
          }
          sub={hasTickets ? <span className={`pill pill-${scoreState}`}>{SCORE_LABEL[scoreState]}</span> : 'No tickets yet'}
        />
        <StatTile
          label="Satisfaction"
          value={
            hasTickets ? (
              <span className="pbs-csat">
                {stats.avgCsat.toFixed(1)}
                <Stars value={stats.avgCsat} size={16} />
              </span>
            ) : (
              '–'
            )
          }
          sub={hasTickets ? 'Average rating out of 5' : 'Rated after each ticket'}
        />
      </section>

      <section className="card" aria-labelledby="pbs-ladder-h">
        <div className="card-head">
          <h2 id="pbs-ladder-h">
            Career ladder
          </h2>
          <span className="pill num">
            {ranksReached}/{RANKS.length} reached
          </span>
        </div>
        <ol className="pbs-ladder">
          {RANKS.map((r, i) => {
            const next = RANKS[i + 1];
            const reached = xp >= r.xp;
            const current = r.title === rank.current.title;
            const frac = reached ? (next ? Math.min(1, (xp - r.xp) / (next.xp - r.xp)) : 1) : 0;
            return (
              <li
                key={r.title}
                className={`pbs-rung ${reached ? 'reached' : 'locked'} ${current ? 'current' : ''}`}
                aria-current={current ? 'step' : undefined}
              >
                <span className="pbs-rung-status">
                  {reached ? (
                    <CircleCheck size={18} role="img" aria-label="Reached" />
                  ) : (
                    <Lock size={16} role="img" aria-label="Locked" />
                  )}
                </span>
                <span className="pbs-rung-title">
                  {r.title}
                  {current && <span className="pill pill-primary">Current</span>}
                </span>
                <ProgressBar value={frac} tone={reached && !current ? 'success' : undefined} />
                <span className="pbs-rung-xp">{fmt(r.xp)} XP</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-2">
        <section className="card pbs-card-col" aria-labelledby="pbs-skills-h">
          <div className="card-head">
            <h2 id="pbs-skills-h">
              Skill breakdown
            </h2>
          </div>
          {hasTickets && <p className="card-sub">Average across all tickets.</p>}
          {!hasTickets ? (
            <EmptyState icon={Activity} title="No skill data yet">
              Complete a ticket to see your skill breakdown.
            </EmptyState>
          ) : (
            <div className="pbs-body">
              <ul className="pbs-skills">
                {SECTIONS.map(({ key, label, icon: Icon }) => {
                  const v = avgs[key];
                  const tone = scoreTone(v * 100);
                  return (
                    <li key={key} className="pbs-skill">
                      <div className="pbs-skill-top">
                        <Icon size={16} aria-hidden />
                        <span className="pbs-skill-name">
                          {label}
                          {weakest?.key === key && <span className="pill pill-primary"><Crosshair aria-hidden />Focus</span>}
                        </span>
                        <span className={`pbs-skill-pct pbs-tone-${tone}`}>{Math.round(v * 100)}%</span>
                      </div>
                      <ProgressBar value={v} tone={tone} />
                    </li>
                  );
                })}
              </ul>
              {weakest && (
                <div className="callout warning small">
                  <Target size={16} aria-hidden />
                  <div className="callout-body">
                    Focus area: <strong>{weakest.label}</strong>. {FOCUS_TIP[weakest.key]}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card pbs-card-col" aria-labelledby="pbs-cats-h">
          <div className="card-head">
            <h2 id="pbs-cats-h">
              Categories
            </h2>
          </div>
          <p className="card-sub">Passed means a best score of 70 or more.</p>
          <div className="table-wrap">
            <table className="table pbs-cat-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Passed</th>
                  <th>Attempts</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => {
                  const cs = cats[c];
                  const done = cs.total > 0 && cs.completed === cs.total;
                  return (
                    <tr key={c}>
                      <td>
                        <span className="pbs-cat">
                          <CategoryIcon category={c} />
                          {c}
                        </span>
                      </td>
                      <td>
                        <span className="pbs-passed">
                          <span className="num">
                            {cs.completed}/{cs.total}
                          </span>
                          <ProgressBar value={cs.total ? cs.completed / cs.total : 0} tone={done ? 'success' : undefined} />
                        </span>
                      </td>
                      <td className="num">{cs.attempts}</td>
                      <td>{cs.attempts ? <span className={`pill pill-${scoreTone(cs.avg)}`}>{cs.avg}</span> : <span className="faint">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pbs-cats-foot">
            <div className="pbs-cats-foot-top">
              <span className="small muted">Built-in tickets passed</span>
              <span className="num pbs-cats-foot-value">
                {catTotals.passed}
                <span className="faint">/{catTotals.total}</span>
              </span>
            </div>
            <ProgressBar value={catTotals.total ? catTotals.passed / catTotals.total : 0} />
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="pbs-badges-h">
        <div className="card-head">
          <h2 id="pbs-badges-h">
            Badges
          </h2>
          <span className="pill num">
            {badgeCount}/{BADGES.length} earned
          </span>
        </div>
        <ul className="grid grid-3 pbs-badge-grid">
          {BADGES.map((b) => {
            const at = earned.get(b.id);
            return (
              <li key={b.id} className={`badge-tile pbs-badge ${at ? 'earned' : 'locked'}`}>
                <div className="icon">
                  <BadgeGlyph icon={b.icon} />
                </div>
                <div className="pbs-badge-text">
                  <div className="badge-name">{b.name}</div>
                  <div className="pbs-badge-desc">{b.description}</div>
                  {at ? (
                    <span className="pbs-badge-status earned">
                      <CircleCheck size={14} aria-hidden />
                      Earned {timeAgo(at)}
                    </span>
                  ) : (
                    <span className="pbs-badge-status">
                      <Lock size={14} aria-hidden />
                      Locked
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="pbs-history-h">
        <div className="card-head">
          <h2 id="pbs-history-h">
            Ticket history
          </h2>
          {hasTickets && <span className="pill num">{state.tickets.length}</span>}
        </div>
        {!hasTickets ? (
          <EmptyState icon={Inbox} title="No tickets yet">
            <p className="pbs-empty-text">Closed tickets appear here with their score and customer rating.</p>
            <Link to="/tickets" className="btn btn-sm">
              <Inbox size={16} aria-hidden />
              Open the ticket queue
            </Link>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table pbs-history">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Category</th>
                  <th>Mode</th>
                  <th>Time</th>
                  <th>CSAT</th>
                  <th>Score</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...state.tickets].reverse().map((t) => (
                  <tr key={t.id}>
                    <td className="pbs-h-ticket">
                      <div className="pbs-ticket">
                        <Link to={`/review/${t.id}`}>{t.title}</Link>
                        <span className="ticket-id">{ticketNumber(t.scenarioId)}</span>
                      </div>
                    </td>
                    <td className="pbs-h-cat">
                      <CategoryPill category={t.category} />
                    </td>
                    <td className="pbs-h-mode">
                      <ModePill mode={t.mode} />
                    </td>
                    <td className="mono small pbs-h-time">
                      <span className="pbs-h-time-inner">
                        <Clock size={14} className="pbs-h-icon" aria-hidden />
                        {formatClock(t.durationSec)}
                      </span>
                    </td>
                    <td className="pbs-h-csat">
                      <Stars value={t.result.csat} size={14} />
                    </td>
                    <td className="pbs-h-score">
                      <span className={`pill pill-${scoreTone(t.result.total)}`}>
                        {t.result.total} · {t.result.grade}
                      </span>
                    </td>
                    <td className="small muted pbs-nowrap pbs-h-when" title={formatDateTime(t.completedAt)}>
                      {timeAgo(t.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
