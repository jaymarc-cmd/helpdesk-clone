import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleHelp,
  GraduationCap,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Repeat,
  RotateCcw,
  Square,
  Target,
  ThumbsDown,
  ThumbsUp,
  VolumeX,
  X,
} from 'lucide-react';
import { CALL_BY_ID } from '../data/calls';
import { callScore, clampMood } from '../engine/calls';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import type { CallAttempt, CallOption, CallScenario } from '../types';
import { EmptyState, PageHeader, ScoreRing, formatClock, initials, useNow } from '../components/ui';
import { useSpeaker } from '../components/speech';
import '../styles/shift-calls.css';

type Line = CallAttempt['transcript'][number];

const OPTION_KEYS = 'ABCDEFGHIJ';

export function CallSession() {
  const { id = '' } = useParams();
  const call = CALL_BY_ID[id];
  if (!call) {
    return (
      <div className="sc-page">
        <Link to="/calls" className="sc-back">
          <ArrowLeft size={16} aria-hidden />
          All calls
        </Link>
        <div className="card">
          <EmptyState icon={PhoneOff} title="Call not found">
            <Link className="btn btn-sm" to="/calls">
              <ArrowLeft size={14} aria-hidden />
              Back to calls
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }
  return <Session key={call.id} call={call} />;
}

function MoodMeter({ mood }: { mood: number }) {
  const cls = mood <= 3 ? 'low' : mood <= 6 ? 'mid' : '';
  const label = mood <= 2 ? 'Furious' : mood <= 4 ? 'Frustrated' : mood <= 6 ? 'Neutral' : mood <= 8 ? 'Satisfied' : 'Delighted';
  const tone = mood <= 3 ? 'sc-text-danger' : mood <= 6 ? 'sc-text-warning' : 'sc-text-success';
  return (
    <div className="sc-mood">
      <div className="sc-mood-head">
        <span className="label">Caller mood</span>
        <span>
          <strong className={tone}>{label}</strong> <span className="mono tiny muted num">{mood}/10</span>
        </span>
      </div>
      <div className={`mood ${cls}`} role="img" aria-label={`Mood ${mood} of 10`}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < mood ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

function FeedbackCallout({ text, points }: { text: string; points: number }) {
  const kind = points >= 6 ? 'success' : points < 0 ? 'danger' : 'warning';
  const Icon = points >= 6 ? ThumbsUp : points < 0 ? ThumbsDown : CircleHelp;
  const verdict = points >= 6 ? 'Good response' : points < 0 ? 'Poor response' : 'Could be better';
  return (
    <div className={`callout small ${kind}`} role="status">
      <Icon size={16} aria-hidden />
      <div className="callout-body">
        <strong>{verdict}.</strong> {text}
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
  const coaching = transcript.filter((l) => l.speaker === 'agent');

  const eyebrow =
    phase === 'ringing' ? (
      <>
        <PhoneIncoming size={14} aria-hidden />
        Incoming call
      </>
    ) : phase === 'live' ? (
      <>
        <span className="live-dot">LIVE</span>
        On call
      </>
    ) : (
      <>
        <PhoneOff size={14} aria-hidden />
        Call ended
      </>
    );

  return (
    <div className="sc-page">
      <Link to="/calls" className="sc-back">
        <ArrowLeft size={16} aria-hidden />
        All calls
      </Link>
      <PageHeader
        eyebrow={eyebrow}
        title={call.title}
        description={`${call.caller}, ${call.role}`}
        actions={
          phase === 'live' && (
            <span className="timer" role="timer" aria-label="Call duration">
              <Phone size={16} aria-hidden />
              {formatClock((now - startedAt) / 1000)}
            </span>
          )
        }
      />

      <div className="call-stage">
        <div className="sc-col">
          {phase === 'ringing' ? (
            <div className="card">
              <div className="sc-ringing">
                <div className="avatar speaking sc-avatar-xl" aria-hidden>
                  {initials(call.caller)}
                </div>
                <span className="pill pill-info">
                  <PhoneIncoming aria-hidden />
                  Incoming call
                </span>
                <div className="sc-ringing-who">
                  <h2>{call.caller}</h2>
                  <p className="muted">{call.role}</p>
                </div>
                <button className="btn btn-primary btn-lg" onClick={answer}>
                  <Phone size={18} aria-hidden />
                  Answer
                </button>
                {!supported && (
                  <div className="callout info small">
                    <VolumeX size={16} aria-hidden />
                    <div className="callout-body">Voice playback isn't supported in this browser. You'll read the caller's lines instead.</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <section className="card sc-transcript">
                <div className="card-head">
                  <h2>
                    <MessageSquare size={18} aria-hidden />
                    Transcript
                  </h2>
                  {phase === 'live' ? (
                    <span className="pill pill-success">
                      <Phone aria-hidden />
                      Connected
                    </span>
                  ) : (
                    <span className="pill">
                      <PhoneOff aria-hidden />
                      Disconnected
                    </span>
                  )}
                </div>

                <div className="chat" aria-live="polite">
                  {transcript.map((l, i) => (
                    <div key={i} className={`msg ${l.speaker === 'agent' ? 'agent' : 'requester'}`}>
                      <span className="who">{l.speaker === 'agent' ? 'You' : call.caller}</span>
                      {l.text}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                {lastFeedback && phase === 'live' && <FeedbackCallout text={lastFeedback.text} points={lastFeedback.points} />}

                {phase === 'live' && node.options && (
                  <div className="sc-options" role="group" aria-label="Your response">
                    <span className="label">Your response</span>
                    {node.options.map((o, i) => (
                      <button key={i} className="option-btn" onClick={() => choose(o)}>
                        <span className="option-key" aria-hidden>
                          {OPTION_KEYS[i] ?? i + 1}
                        </span>
                        <span className="sc-option-text">{o.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {phase === 'ended' && (
                <section className="card" aria-label="Call result">
                  <div className="sc-outcome">
                    <ScoreRing score={score} label="Call score" />
                    <div className="sc-outcome-body">
                      <h2>Call ended</h2>
                      <p>{node.ending}</p>
                      <div className="row">
                        <Link className="btn btn-primary" to="/calls">
                          <PhoneCall size={16} aria-hidden />
                          More calls
                        </Link>
                        <button className="btn" onClick={() => window.location.reload()}>
                          <RotateCcw size={16} aria-hidden />
                          Retry this call
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="sc-coaching">
                    <div className="card-head">
                      <h3>
                        <GraduationCap size={17} aria-hidden />
                        Coaching
                      </h3>
                    </div>
                    <ul className="check-list">
                      {coaching.map((l, i) => {
                        const good = (l.points ?? 0) >= 6;
                        return (
                          <li key={i}>
                            {good ? (
                              <Check size={16} className="ok" role="img" aria-label="Good" />
                            ) : (
                              <X size={16} className="no" role="img" aria-label="Needs work" />
                            )}
                            <span>{l.feedback}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="sc-col">
          <div className="card sc-side-card">
            <div className="sc-caller">
              <div className={`avatar ${speaking ? 'speaking' : ''}`} aria-hidden>
                {initials(call.caller)}
              </div>
              <div>
                <strong>{call.caller}</strong>
                <div className="tiny muted">{call.role}</div>
              </div>
            </div>
            <MoodMeter mood={mood} />
            {phase !== 'ringing' && supported && state.settings.voice && (
              <button className="btn btn-sm" onClick={() => (speaking ? stop() : say(node.caller))}>
                {speaking ? <Square size={14} aria-hidden /> : <Repeat size={14} aria-hidden />}
                {speaking ? 'Stop voice' : 'Replay caller'}
              </button>
            )}
          </div>
          <div className="card sc-side-card">
            <div className="card-head">
              <h3>
                <Target size={17} aria-hidden />
                Skills in focus
              </h3>
            </div>
            <div className="sc-skills">
              {call.skills.map((s) => (
                <span key={s} className="pill pill-primary">
                  {s}
                </span>
              ))}
            </div>
            <p className="small muted">{call.summary}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
