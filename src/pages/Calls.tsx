import { Link } from 'react-router-dom';
import { Headset, History, PhoneCall, Trophy, Volume2, VolumeX } from 'lucide-react';
import { CALLS } from '../data/calls';
import { useStore } from '../state/store';
import { DifficultyDots, PageHeader, initials, scoreTone, timeAgo } from '../components/ui';
import '../styles/shift-calls.css';

function moodTone(mood: number): 'danger' | 'warning' | 'success' {
  return mood <= 3 ? 'danger' : mood <= 6 ? 'warning' : 'success';
}

export function CallsPage() {
  const { state, dispatch } = useStore();
  const best: Record<string, number> = {};
  for (const c of state.calls) best[c.callId] = Math.max(best[c.callId] ?? 0, c.score);
  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const voiceOn = state.settings.voice;

  return (
    <div className="sc-page">
      <PageHeader
        eyebrow={
          <>
            <Headset size={14} aria-hidden />
            Practice
          </>
        }
        title="Voice calls"
        description="Live phone simulations with spoken callers. Every choice changes the caller's mood and the outcome."
        actions={
          <label className={`sc-voice ${voiceOn ? 'on' : ''}`}>
            {voiceOn ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
            <span className="sc-voice-text">
              <span>Caller voice</span>
              {!speechOk && <span className="sc-voice-hint">Not supported in this browser</span>}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="sc-switch"
              checked={voiceOn}
              onChange={(e) => dispatch({ type: 'settings', patch: { voice: e.target.checked } })}
            />
          </label>
        }
      />

      <section className="grid grid-auto" aria-label="Available calls">
        {CALLS.map((c) => (
          <article key={c.id} className="card sc-call-card">
            <div className="sc-call-head">
              <div className="avatar sc-avatar-sm" aria-hidden>
                {initials(c.caller)}
              </div>
              <div>
                <h2 className="sc-call-title">{c.title}</h2>
                <div className="sc-call-who">
                  {c.caller} · {c.role}
                </div>
              </div>
            </div>
            <p className="sc-call-summary">{c.summary}</p>
            <div className="sc-skills" aria-label="Skills practised">
              {c.skills.map((s) => (
                <span key={s} className="pill pill-outline">
                  {s}
                </span>
              ))}
            </div>
            <div className="sc-call-foot">
              <div className="spread">
                <DifficultyDots d={c.difficulty} showLabel />
                {best[c.id] !== undefined ? (
                  <span className={`pill pill-${scoreTone(best[c.id])}`}>
                    <Trophy aria-hidden />
                    Best {best[c.id]}
                  </span>
                ) : (
                  <span className="pill pill-outline">Not attempted</span>
                )}
              </div>
              <Link className="btn btn-block sc-call-cta" to={`/call/${c.id}`}>
                <PhoneCall size={16} aria-hidden />
                Take call
              </Link>
            </div>
          </article>
        ))}
      </section>

      {state.calls.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              <History size={18} aria-hidden />
              Recent calls
            </h2>
            <span className="pill num">{state.calls.length} completed</span>
          </div>
          <div className="table-wrap">
            <table className="table sc-rtable">
              <thead>
                <tr>
                  <th>Call</th>
                  <th>Score</th>
                  <th>Final mood</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...state.calls]
                  .reverse()
                  .slice(0, 10)
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="sc-rtable-title">{c.title}</td>
                      <td data-label="Score">
                        <span className={`pill pill-${scoreTone(c.score)}`}>{c.score}</span>
                      </td>
                      <td data-label="Final mood">
                        <span className={`pill pill-${moodTone(c.finalMood)}`}>{c.finalMood}/10</span>
                      </td>
                      <td className="muted" data-label="When">
                        {timeAgo(c.completedAt)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
