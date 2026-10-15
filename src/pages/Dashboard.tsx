import { Link, useNavigate } from 'react-router-dom';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { bestByScenario, categoryStats, overallStats, rankFor, totalXp } from '../engine/progress';
import { useStore } from '../state/store';
import { CATEGORIES } from '../types';
import { DifficultyDots, PriorityPill, ProgressBar, Stars, scoreTone, timeAgo } from '../components/ui';

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

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="hero">
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={{ marginBottom: 6 }}>Good to see you, {firstName} 👋</h1>
          <p className="mb">
            Level {rank.level} · {rank.current.title} · {xp} XP
          </p>
          <ProgressBar value={rank.progress} />
          <p className="small" style={{ marginTop: 6 }}>
            {rank.next ? `${rank.next.xp - xp} XP to ${rank.next.title}` : 'You reached the top rank!'}
          </p>
        </div>
        <div className="row">
          {state.activeShift ? (
            <Link className="btn btn-lg" to="/shift">
              ⏱️ Resume shift
            </Link>
          ) : (
            <Link className="btn btn-lg" to="/shift">
              ⏱️ Start a shift
            </Link>
          )}
          {recommended && (
            <button className="btn btn-lg" onClick={() => navigate(`/ticket/${recommended.id}`)}>
              🎯 Recommended ticket
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-4">
        <div className="card stat">
          <span className="value">{stats.tickets}</span>
          <span className="label">Tickets closed</span>
        </div>
        <div className="card stat">
          <span className="value">{stats.tickets ? stats.avgScore : '–'}</span>
          <span className="label">Average score</span>
        </div>
        <div className="card stat">
          <span className="value">{stats.tickets ? <Stars value={stats.avgCsat} /> : '–'}</span>
          <span className="label">Avg. customer satisfaction</span>
        </div>
        <div className="card stat">
          <span className="value">
            {state.badges.length}
            <span className="muted small"> badges</span>
          </span>
          <span className="label">
            {stats.calls} calls · {stats.interviews} interviews · {stats.shifts} shifts
          </span>
        </div>
      </section>

      <section className="grid grid-4">
        {[
          { to: '/tickets', icon: '🎫', title: 'Work tickets', text: `${BUILTIN_SCENARIOS.length} realistic scenarios across 6 categories.` },
          { to: '/calls', icon: '📞', title: 'Take a voice call', text: 'Spoken callers, branching dialogue and a live mood meter.' },
          { to: '/interview', icon: '💼', title: 'Mock interview', text: 'Timed questions with instant feedback on key points.' },
          { to: '/kb', icon: '📖', title: 'Knowledge base', text: 'Runbooks you can also open from inside every ticket.' },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="card quick">
            <span className="qi" aria-hidden>
              {q.icon}
            </span>
            <strong>{q.title}</strong>
            <span className="small muted">{q.text}</span>
          </Link>
        ))}
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="spread mb">
            <h2 style={{ margin: 0 }}>Skill mastery</h2>
            <Link to="/progress" className="small">
              Details →
            </Link>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {CATEGORIES.map((c) => (
              <div key={c}>
                <div className="spread small">
                  <span>{c}</span>
                  <span className="muted">
                    {cats[c].completed}/{cats[c].total} passed
                  </span>
                </div>
                <ProgressBar value={cats[c].completed / cats[c].total} tone={cats[c].completed === cats[c].total ? 'success' : undefined} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="spread mb">
            <h2 style={{ margin: 0 }}>Recent activity</h2>
            <Link to="/tickets" className="small">
              Queue →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty">
              <p>No tickets yet. Your queue is waiting!</p>
              {recommended && (
                <div className="card card-tight" style={{ textAlign: 'left' }}>
                  <div className="row small">
                    <PriorityPill p={recommended.priority} />
                    <span className="pill">{recommended.category}</span>
                    <DifficultyDots d={recommended.difficulty} />
                  </div>
                  <div style={{ fontWeight: 700, margin: '6px 0' }}>{recommended.title}</div>
                  <Link className="btn btn-primary btn-sm" to={`/ticket/${recommended.id}`}>
                    Start this ticket
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {recent.map((t) => (
                <Link key={t.id} to={`/review/${t.id}`} className="spread card card-tight" style={{ color: 'inherit' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="tiny muted">
                      {t.category} · {timeAgo(t.completedAt)} {t.mode === 'shift' ? '· shift' : ''}
                    </div>
                  </div>
                  <span className={`pill pill-${scoreTone(t.result.total)}`}>
                    {t.result.total} · {t.result.grade}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
