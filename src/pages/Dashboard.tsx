import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  ChevronRight,
  CircleCheck,
  Clock,
  Crosshair,
  GraduationCap,
  Inbox,
  LibraryBig,
  PhoneCall,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { recommendTicket } from '../engine/coach';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { BADGES, bestByScenario, categoryStats, overallStats, rankFor, totalXp } from '../engine/progress';
import { shiftEndsAt } from '../engine/shift';
import { useStore } from '../state/store';
import { CATEGORIES } from '../types';
import { CATEGORY_ICON, CategoryIcon } from '../components/icons';
import {
  CategoryPill,
  EmptyState,
  IconTile,
  ModePill,
  ProgressBar,
  Stars,
  StatTile,
  scoreTone,
  ticketNumber,
  timeAgo,
  useDocumentTitle,
  useNow,
} from '../components/ui';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmt = (n: number) => n.toLocaleString('en-US');

const SCORE_LABEL: Record<'success' | 'warning' | 'danger', string> = {
  success: 'On target',
  warning: 'Getting there',
  danger: 'Needs work',
};

export function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();
  useDocumentTitle('Dashboard');
  const xp = totalXp(state);
  const rank = rankFor(xp);
  const stats = overallStats(state);
  const cats = categoryStats(state);
  const best = bestByScenario(state);

  // Recommend: an unpassed ticket in the weakest category, at a difficulty that follows your recent scores.
  const weakest = [...CATEGORIES].sort((a, b) => cats[a].completed / cats[a].total - cats[b].completed / cats[b].total)[0];
  const recommended = recommendTicket(BUILTIN_SCENARIOS, best, weakest, state.tickets);

  const recent = [...state.tickets].reverse().slice(0, 5);
  const firstName = state.profile?.name.trim().split(/\s+/)[0];
  const greeting = firstName ? `Good to see you, ${firstName}` : 'Welcome to the service desk';

  const shift = state.activeShift;
  const now = useNow(15_000);
  const waiting = shift ? shift.tickets.filter((t) => t.status === 'waiting').length : 0;
  const handled = shift ? shift.tickets.filter((t) => t.status === 'done').length : 0;
  const minutesLeft = shift ? Math.ceil((shiftEndsAt(shift) - now) / 60_000) : 0;
  const passed = CATEGORIES.reduce((n, c) => n + cats[c].completed, 0);
  const scoreState = scoreTone(stats.avgScore);

  const lead = shift
    ? 'You are on shift. Work the waiting tickets before their SLA timers run out.'
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
    <div className="page dash">
      <section className="hero dash-hero" aria-labelledby="dash-greeting">
        <div className="dash-hero-main">
          <h1 id="dash-greeting">{greeting}</h1>
          <p className="dash-lead">{lead}</p>

          <div className="dash-rank">
            <div className="dash-rank-row">
              <span className="dash-rank-level">
                <Award size={12} aria-hidden />
                Level {rank.level}
              </span>
              <span className="dash-rank-title">{rank.current.title}</span>
              <span className="dash-rank-xp">{fmt(xp)} XP</span>
            </div>
            <ProgressBar value={rank.progress} />
            <div className="dash-rank-next">{rank.next ? `${fmt(rank.next.xp - xp)} XP to ${rank.next.title}` : 'Top rank reached'}</div>
          </div>
        </div>

        <div className="dash-hero-side">
          {shift ? (
            <div className="dash-next dash-next-live">
              <div className="dash-next-label">
                <span className="status-dot bad" aria-hidden />
                Shift in progress
              </div>
              <div className="dash-next-title">{waiting === 0 ? 'No tickets waiting' : `${plural(waiting, 'ticket')} waiting`}</div>
              <div className="dash-next-meta">
                <span className="inline-icon">
                  <Clock size={14} aria-hidden />
                  {minutesLeft > 0 ? `${minutesLeft} min left` : 'Time is up'}
                </span>
                <span>{handled} handled</span>
                {shift.pending.length > 0 && <span>{shift.pending.length} still to arrive</span>}
              </div>
            </div>
          ) : recommended ? (
            <div className="dash-next">
              <div className="dash-next-label">
                <Target size={14} aria-hidden />
                Recommended next
              </div>
              <div className="dash-next-title">{recommended.title}</div>
              <div className="dash-next-meta">
                <span className="mono">{ticketNumber(recommended.id)}</span>
                <span className="inline-icon">
                  <CategoryIcon category={recommended.category} size={14} />
                  {recommended.category}
                </span>
                <span className="mono">{recommended.priority}</span>
              </div>
            </div>
          ) : (
            <div className="dash-next">
              <div className="dash-next-label">
                <Trophy size={14} aria-hidden />
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
                  <Timer size={16} aria-hidden />
                  {shiftLabel}
                </Link>
                {openRecommended && (
                  <button type="button" className="btn btn-lg" onClick={openRecommended}>
                    <Target size={16} aria-hidden />
                    Recommended ticket
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-lg" onClick={openRecommended}>
                  <Target size={16} aria-hidden />
                  Recommended ticket
                </button>
                <Link className="btn btn-lg" to="/shift">
                  <Timer size={16} aria-hidden />
                  {shiftLabel}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card stat-strip" aria-label="Your figures">
        <StatTile
          label="Tickets closed"
          value={stats.tickets}
          sub={`${passed} of ${BUILTIN_SCENARIOS.length} scenarios passed`}
        />
        <StatTile
          label="Average score"
          value={
            stats.tickets ? (
              <>
                {stats.avgScore}
                <span className="faint">/100</span>
              </>
            ) : (
              '–'
            )
          }
          sub={stats.tickets ? <span className={`pill pill-${scoreState}`}>{SCORE_LABEL[scoreState]}</span> : 'No tickets yet'}
        />
        <StatTile
          label="Satisfaction"
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
          sub={stats.tickets ? 'Average rating out of 5' : 'Rated after each ticket'}
        />
        <StatTile
          label="Badges"
          value={
            <>
              {state.badges.length}
              <span className="faint">/{BADGES.length}</span>
            </>
          }
          sub={state.badges.length >= BADGES.length ? 'Full set collected' : `${BADGES.length - state.badges.length} still to unlock`}
        />
      </section>

      <section className="card dash-quick" aria-labelledby="dash-quick-title">
        <div className="card-head">
          <h2 id="dash-quick-title">Practice</h2>
        </div>
        <ul className="quick-list">
          {quick.map((q) => (
            <li key={q.to}>
              <Link to={q.to} className="quick-row">
                <q.icon size={18} className="quick-icon" aria-hidden />
                <span className="quick-text">
                  <strong>{q.title}</strong>
                  <span className="quick-desc">{q.text}</span>
                </span>
                <span className="quick-meta num">{q.meta}</span>
                <ArrowRight className="quick-arrow" size={16} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-2 dash-panels">
        <div className="card dash-panel">
          <div className="card-head">
            <h2>
              Skill mastery
            </h2>
            <Link to="/progress" className="dash-head-link">
              Details
              <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          <p className="card-sub">Built-in scenarios passed at 70 or above, by category.</p>
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

        <div className="card dash-panel">
          <div className="card-head">
            <h2>
              Recent activity
            </h2>
            <Link to="/tickets" className="dash-head-link">
              Queue
              <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          <p className="card-sub">Your most recent closed tickets, newest first.</p>
          {recent.length === 0 ? (
            <div className="dash-empty">
              <EmptyState icon={Inbox} title="No tickets closed yet">
                Every ticket you close lands here with its score and grade, so you can reopen the review and see what to improve.
              </EmptyState>
              <Link className="btn btn-sm" to="/tickets">
                <Inbox size={16} aria-hidden />
                Browse the queue
              </Link>
            </div>
          ) : (
            <ul className="activity">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link to={`/review/${t.id}`} className="activity-item">
                    <span className="activity-body">
                      <span className="activity-title">{t.title}</span>
                      <span className="activity-meta">
                        <CategoryPill category={t.category} />
                        <ModePill mode={t.mode} />
                        <span className="activity-when">{timeAgo(t.completedAt)}</span>
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
