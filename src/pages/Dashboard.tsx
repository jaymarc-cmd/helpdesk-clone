import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  ChartNoAxesColumn,
  ChevronRight,
  CircleCheck,
  Crosshair,
  Gauge,
  GraduationCap,
  Headset,
  History,
  Inbox,
  LibraryBig,
  PhoneCall,
  Play,
  Smile,
  Target,
  TicketCheck,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { BADGES, bestByScenario, categoryStats, overallStats, rankFor, totalXp } from '../engine/progress';
import { useStore } from '../state/store';
import { CATEGORIES } from '../types';
import { CATEGORY_ICON, CategoryIcon } from '../components/icons';
import { DifficultyDots, EmptyState, IconTile, PriorityPill, ProgressBar, Stars, StatTile, scoreTone, ticketNumber, timeAgo } from '../components/ui';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const SCORE_LABEL: Record<'success' | 'warning' | 'danger', string> = {
  success: 'On target',
  warning: 'Developing',
  danger: 'Needs work',
};

export function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const stats = overallStats(state);
  const cats = categoryStats(state);
  const best = bestByScenario(state);

  // Recommend: an unattempted ticket in the weakest category, easiest first.
  const weakest = [...CATEGORIES].sort((a, b) => cats[a].completed / cats[a].total - cats[b].completed / cats[b].total)[0];
  const recommended =
    BUILTIN_SCENARIOS.filter((s) => s.category === weakest && (best[s.id] ?? 0) < 70).sort((a, b) => a.difficulty - b.difficulty)[0] ??
    BUILTIN_SCENARIOS.find((s) => (best[s.id] ?? 0) < 70);

  const recent = [...state.tickets].reverse().slice(0, 5);
  const firstName = state.profile?.name.split(' ')[0] ?? 'there';

  const shift = state.activeShift;
  const waiting = shift ? shift.tickets.filter((t) => t.status === 'waiting').length : 0;
  const passed = CATEGORIES.reduce((n, c) => n + cats[c].completed, 0);
  const scoreState = scoreTone(stats.avgScore);
  const csatTone = stats.avgCsat >= 4 ? 'success' : stats.avgCsat >= 3 ? 'warning' : 'danger';

  const lead = shift
    ? `Your shift is running with ${plural(waiting, 'ticket')} waiting in the shift queue.`
    : stats.tickets === 0
      ? 'Your queue is open. Start with the recommended ticket, or run a timed shift when you feel ready.'
      : recommended
        ? `You have closed ${plural(stats.tickets, 'ticket')} so far. Your next focus area is ${recommended.category}.`
        : 'Every built-in ticket is passed. Shifts and custom scenarios keep your skills sharp.';

  const quick: { to: string; icon: LucideIcon; title: string; text: string; meta: string }[] = [
    {
      to: '/tickets',
      icon: Inbox,
      title: 'Work tickets',
      text: `${BUILTIN_SCENARIOS.length} realistic scenarios across ${CATEGORIES.length} categories.`,
      meta: `${stats.tickets} closed`,
    },
    {
      to: '/calls',
      icon: PhoneCall,
      title: 'Take a voice call',
      text: 'Spoken callers, branching dialogue and a live mood meter.',
      meta: `${stats.calls} completed`,
    },
    {
      to: '/interview',
      icon: GraduationCap,
      title: 'Mock interview',
      text: 'Timed questions with instant feedback on key points.',
      meta: `${stats.interviews} completed`,
    },
    {
      to: '/kb',
      icon: LibraryBig,
      title: 'Knowledge base',
      text: 'Runbooks you can also open from inside every ticket.',
      meta: `${state.kbRead.length} read`,
    },
  ];

  const openRecommended = recommended ? () => navigate(`/ticket/${recommended.id}`) : undefined;
  const shiftLabel = shift ? 'Resume shift' : 'Start a shift';

  return (
    <div className="dash">
      <section className="hero dash-hero" aria-labelledby="dash-greeting">
        <div className="dash-hero-main">
          <div className="eyebrow">
            <Headset size={14} aria-hidden />
            <span>Service desk · Harbor &amp; Pine Logistics</span>
            {shift && <span className="live-dot">SHIFT LIVE</span>}
          </div>
          <h1 id="dash-greeting">Good to see you, {firstName}</h1>
          <p className="dash-lead">{lead}</p>

          <div className="dash-rank">
            <div className="dash-rank-row">
              <span className="dash-rank-level">
                <Award size={13} aria-hidden />
                Level {rank.level}
              </span>
              <span className="dash-rank-title">{rank.current.title}</span>
              <span className="dash-rank-xp">{xp} XP</span>
            </div>
            <ProgressBar value={rank.progress} />
            <div className="dash-rank-next">{rank.next ? `${rank.next.xp - xp} XP to ${rank.next.title}` : 'Top rank reached'}</div>
          </div>
        </div>

        <div className="dash-hero-side">
          {recommended ? (
            <div className="dash-next">
              <div className="dash-next-label">
                <Target size={13} aria-hidden />
                Recommended next
              </div>
              <div className="dash-next-title">{recommended.title}</div>
              <div className="dash-next-meta">
                <span className="mono">{ticketNumber(recommended.id)}</span>
                <span className="inline-icon">
                  <CategoryIcon category={recommended.category} size={13} />
                  {recommended.category}
                </span>
                <span className="mono">{recommended.priority}</span>
              </div>
            </div>
          ) : (
            <div className="dash-next">
              <div className="dash-next-label">
                <Trophy size={13} aria-hidden />
                Queue cleared
              </div>
              <div className="dash-next-title">Every built-in ticket is passed</div>
              <div className="dash-next-meta">Run a shift or write your own scenario in the builder.</div>
            </div>
          )}
          <div className="dash-hero-actions">
            {shift || !openRecommended ? (
              <>
                <Link className="btn btn-primary btn-lg" to="/shift">
                  <Timer size={18} aria-hidden />
                  {shiftLabel}
                </Link>
                {openRecommended && (
                  <button type="button" className="btn btn-lg" onClick={openRecommended}>
                    <Target size={18} aria-hidden />
                    Recommended ticket
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-lg" onClick={openRecommended}>
                  <Target size={18} aria-hidden />
                  Recommended ticket
                </button>
                <Link className="btn btn-lg" to="/shift">
                  <Timer size={18} aria-hidden />
                  {shiftLabel}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-4 dash-stats" aria-label="Your figures">
        <StatTile
          label="Tickets closed"
          icon={TicketCheck}
          tone="primary"
          value={stats.tickets}
          sub={`${passed} of ${BUILTIN_SCENARIOS.length} scenarios passed`}
        />
        <StatTile
          label="Average score"
          icon={Gauge}
          tone={stats.tickets ? scoreState : 'neutral'}
          value={
            stats.tickets ? (
              <span className="dash-value">
                {stats.avgScore}
                <span className="dash-value-of">/100</span>
              </span>
            ) : (
              '–'
            )
          }
          sub={stats.tickets ? <span className={`pill pill-${scoreState}`}>{SCORE_LABEL[scoreState]}</span> : 'No graded tickets yet'}
        />
        <StatTile
          label="Customer satisfaction"
          icon={Smile}
          tone={stats.tickets ? csatTone : 'neutral'}
          value={
            stats.tickets ? (
              <span className="dash-csat">
                {stats.avgCsat.toFixed(1)}
                <Stars value={stats.avgCsat} size={16} />
              </span>
            ) : (
              '–'
            )
          }
          sub={stats.tickets ? 'Average CSAT, out of 5' : 'Rated when you close a ticket'}
        />
        <StatTile
          label="Badges"
          icon={Award}
          tone="primary"
          value={
            <span className="dash-value">
              {state.badges.length}
              <span className="dash-value-of">/{BADGES.length}</span>
            </span>
          }
          sub={`${plural(stats.calls, 'call')} · ${plural(stats.interviews, 'interview')} · ${plural(stats.shifts, 'shift')}`}
        />
      </section>

      <section className="dash-section" aria-labelledby="dash-quick-title">
        <h2 id="dash-quick-title" className="label">
          Quick start
        </h2>
        <div className="grid grid-4 dash-quick">
          {quick.map((q) => (
            <Link key={q.to} to={q.to} className="card quick">
              <IconTile icon={q.icon} tone="primary" />
              <span className="quick-text">
                <strong>{q.title}</strong>
                <span className="small muted">{q.text}</span>
                <span className="quick-meta">{q.meta}</span>
              </span>
              <ArrowRight className="quick-arrow" size={16} aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div className="dash-head-text">
              <h2>
                <ChartNoAxesColumn size={18} aria-hidden />
                Skill mastery
              </h2>
              <p>Built-in scenarios passed at 70 or above, by category.</p>
            </div>
            <Link to="/progress" className="dash-head-link">
              Details
              <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          <ul className="mastery">
            {CATEGORIES.map((c) => {
              const s = cats[c];
              const mastered = s.completed === s.total;
              const focus = !mastered && c === weakest;
              return (
                <li key={c}>
                  <IconTile icon={CATEGORY_ICON[c]} tone={mastered ? 'success' : focus ? 'primary' : 'neutral'} size="sm" />
                  <div className="mastery-body">
                    <div className="mastery-top">
                      <span className="mastery-name">{c}</span>
                      {mastered && (
                        <span className="pill pill-success">
                          <CircleCheck aria-hidden />
                          Mastered
                        </span>
                      )}
                      {focus && (
                        <span className="pill pill-primary">
                          <Crosshair aria-hidden />
                          Focus
                        </span>
                      )}
                      <span className="mastery-count">
                        {s.completed}/{s.total} passed
                      </span>
                    </div>
                    <ProgressBar value={s.completed / s.total} tone={mastered ? 'success' : undefined} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="dash-head-text">
              <h2>
                <History size={18} aria-hidden />
                Recent activity
              </h2>
              <p>Your most recent closed tickets, newest first.</p>
            </div>
            <Link to="/tickets" className="dash-head-link">
              Queue
              <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="dash-empty">
              <EmptyState icon={Inbox} title="No tickets closed yet">
                Closed tickets appear here with their score and grade.
                {recommended ? ' This one is a good place to start.' : ''}
              </EmptyState>
              {recommended && (
                <div className="card card-flat card-tight dash-rec">
                  <div className="dash-rec-meta">
                    <span className="ticket-id">{ticketNumber(recommended.id)}</span>
                    <PriorityPill p={recommended.priority} />
                    <span className="pill">
                      <CategoryIcon category={recommended.category} />
                      {recommended.category}
                    </span>
                    <DifficultyDots d={recommended.difficulty} />
                  </div>
                  <div className="dash-rec-title">{recommended.title}</div>
                  <div>
                    <Link className="btn btn-primary btn-sm" to={`/ticket/${recommended.id}`}>
                      <Play size={14} aria-hidden />
                      Start this ticket
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ul className="activity">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link to={`/review/${t.id}`} className="activity-item">
                    <IconTile icon={CATEGORY_ICON[t.category]} tone="neutral" size="sm" />
                    <span className="activity-body">
                      <span className="activity-title">{t.title}</span>
                      <span className="activity-meta">
                        <span>{t.category}</span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(t.completedAt)}</span>
                        {t.mode === 'shift' && (
                          <span className="pill pill-outline">
                            <Timer aria-hidden />
                            Shift
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`pill pill-${scoreTone(t.result.total)} activity-score`}>
                      {t.result.total} · {t.result.grade}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
