import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CALL_BY_ID } from '../data/calls';
import { callScore, clampMood } from '../engine/calls';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import type { CallAttempt, CallOption, CallScenario } from '../types';
import { ScoreRing, formatClock, initials, useNow } from '../components/ui';
import { useSpeaker } from '../components/speech';

type Line = CallAttempt['transcript'][number];

export function CallSession() {
  const { id = '' } = useParams();
  const call = CALL_BY_ID[id];
  if (!call) {
    return (
      <div className="card empty">
        <p>Call not found.</p>
        <Link className="btn" to="/calls">
          Back to calls
        </Link>
      </div>
    );
  }
  return <Session key={call.id} call={call} />;
}

function MoodMeter({ mood }: { mood: number }) {
  const cls = mood <= 3 ? 'low' : mood <= 6 ? 'mid' : '';
  const label = mood <= 2 ? 'Furious' : mood <= 4 ? 'Frustrated' : mood <= 6 ? 'Neutral' : mood <= 8 ? 'Satisfied' : 'Delighted';
  return (
    <div>
      <div className="spread small">
        <span>Caller mood</span>
        <strong>{label}</strong>
      </div>
      <div className={`mood ${cls}`} aria-label={`Mood ${mood} of 10`}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < mood ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

function Session({ call }: { call: CallScenario }) {
  const { state, dispatch } = useStore();
  const { speak, stop, speaking, supported } = useSpeaker(state.settings.voice, state.settings.voiceRate);
  const nodes = new Map(call.nodes.map((n) => [n.id, n]));
  const [phase, setPhase] = useState<'ringing' | 'live' | 'ended'>('ringing');
  const [nodeId, setNodeId] = useState(call.start);
  const [mood, setMood] = useState(call.startMood);
  const [points, setPoints] = useState(0);
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; points: number } | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const saved = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const node = nodes.get(nodeId)!;

  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [transcript.length]);
  useEffect(() => () => stop(), [stop]);

  const say = (text: string) => speak(text, call.voice);

  const answer = () => {
    setPhase('live');
    setStartedAt(Date.now());
    setTranscript([{ speaker: 'caller', text: node.caller }]);
    say(node.caller);
  };

  const choose = (o: CallOption) => {
    const next = nodes.get(o.next)!;
    const newMood = clampMood(mood + o.mood);
    const newPoints = points + o.points;
    const lines: Line[] = [{ speaker: 'agent', text: o.text, feedback: o.feedback, points: o.points }];
    if (next.caller) lines.push({ speaker: 'caller', text: next.caller });
    const full = [...transcript, ...lines];
    setTranscript(full);
    setMood(newMood);
    setPoints(newPoints);
    setLastFeedback({ text: o.feedback, points: o.points });
    setNodeId(next.id);
    if (next.caller) say(next.caller);
    if (!next.options?.length) {
      setPhase('ended');
      if (!saved.current) {
        saved.current = true;
        dispatch({
          type: 'addCall',
          attempt: {
            id: uid('c'),
            callId: call.id,
            title: call.title,
            completedAt: new Date().toISOString(),
            score: callScore(newPoints, call),
            finalMood: newMood,
            transcript: full,
          },
        });
      }
    }
  };

  const score = callScore(points, call);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <Link to="/calls" className="small">
            ← All calls
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>{call.title}</h1>
        </div>
        {phase === 'live' && <span className="timer">📞 {formatClock((now - startedAt) / 1000)}</span>}
      </div>

      <div className="call-stage">
        <div className="card stack">
          {phase === 'ringing' ? (
            <div className="empty stack" style={{ alignItems: 'center' }}>
              <div className="avatar speaking" style={{ width: 88, height: 88, fontSize: '1.6rem' }}>
                {initials(call.caller)}
              </div>
              <h2 style={{ margin: 0 }}>Incoming call…</h2>
              <p style={{ margin: 0 }}>
                {call.caller}, {call.role}
              </p>
              <button className="btn btn-primary btn-lg" onClick={answer}>
                📞 Answer
              </button>
              {!supported && <p className="small">Voice playback isn't supported in this browser. You'll read the caller's lines instead.</p>}
            </div>
          ) : (
            <>
              <div className="chat" style={{ maxHeight: 460 }} aria-live="polite">
                {transcript.map((l, i) => (
                  <div key={i} className={`msg ${l.speaker === 'agent' ? 'agent' : 'requester'}`}>
                    <span className="who">{l.speaker === 'agent' ? 'You' : call.caller}</span>
                    {l.text}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {lastFeedback && phase === 'live' && (
                <div className={`callout small ${lastFeedback.points >= 6 ? 'success' : lastFeedback.points < 0 ? 'danger' : 'warning'}`}>
                  {lastFeedback.points >= 6 ? '👍' : lastFeedback.points < 0 ? '👎' : '🤔'} {lastFeedback.text}
                </div>
              )}

              {phase === 'live' && node.options && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="tiny muted">YOUR RESPONSE</div>
                  {node.options.map((o, i) => (
                    <button key={i} className="option-btn" onClick={() => choose(o)}>
                      {o.text}
                    </button>
                  ))}
                </div>
              )}

              {phase === 'ended' && (
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <div className="row" style={{ gap: 24 }}>
                    <ScoreRing score={score} label="Call score" />
                    <div className="stack" style={{ flex: '1 1 240px', gap: 6 }}>
                      <h2 style={{ margin: 0 }}>Call ended</h2>
                      <p style={{ margin: 0 }}>{node.ending}</p>
                      <div className="row">
                        <Link className="btn btn-primary" to="/calls">
                          More calls
                        </Link>
                        <button className="btn" onClick={() => window.location.reload()}>
                          ↻ Retry this call
                        </button>
                      </div>
                    </div>
                  </div>
                  <h3 className="mt">Coaching</h3>
                  <ul className="check-list">
                    {transcript
                      .filter((l) => l.speaker === 'agent')
                      .map((l, i) => (
                        <li key={i}>
                          <span className={(l.points ?? 0) >= 6 ? 'ok' : 'no'}>{(l.points ?? 0) >= 6 ? '✓' : '✗'}</span>
                          <span>{l.feedback}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="row">
              <div className={`avatar ${speaking ? 'speaking' : ''}`}>{initials(call.caller)}</div>
              <div>
                <strong>{call.caller}</strong>
                <div className="tiny muted">{call.role}</div>
              </div>
            </div>
            <MoodMeter mood={mood} />
            {phase !== 'ringing' && supported && state.settings.voice && (
              <button className="btn btn-sm" onClick={() => (speaking ? stop() : say(node.caller))}>
                {speaking ? '⏹ Stop voice' : '🔁 Replay caller'}
              </button>
            )}
          </div>
          <div className="card">
            <h3>Skills in focus</h3>
            <div className="row">
              {call.skills.map((s) => (
                <span key={s} className="pill pill-primary">
                  {s}
                </span>
              ))}
            </div>
            <p className="small muted mt" style={{ marginBottom: 0 }}>
              {call.summary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
