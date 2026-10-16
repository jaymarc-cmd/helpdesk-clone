import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CircleHelp,
  Clock,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Repeat,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  VolumeX,
} from 'lucide-react';
import { CALL_BY_ID } from '../data/calls';
import { callScore, clampMood } from '../engine/calls';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import type { CallAttempt, CallOption, CallScenario } from '../types';
import { DifficultyDots, EmptyState, LivePill, PageHeader, ScoreRing, formatClock, initials, useNow } from '../components/ui';
import { useSpeaker } from '../components/speech';
import '../styles/shift-calls.css';

type Line = CallAttempt['transcript'][number];

const OPTION_KEYS = 'ABCDEFGHIJ';

const BACK = { to: '/calls', label: 'Voice calls' };

export function CallSession() {
  const { id = '' } = useParams();
  const call = CALL_BY_ID[id];
  // Bumped by "Retry this call": a new key remounts the session so every piece of call state starts fresh.
  const [run, setRun] = useState(0);
  if (!call) {
    return (
      <div className="page sc-page">
        <PageHeader
          back={BACK}
          title="Call not found"
        />
        <div className="card">
          <EmptyState icon={PhoneOff} title="This call isn't in the library">
            <div className="sc-empty-body">
              <span>The link may be out of date. Pick a caller from the voice calls list instead.</span>
              <Link className="btn btn-sm" to="/calls">
                <ArrowLeft size={14} aria-hidden />
                Back to calls
              </Link>
            </div>
          </EmptyState>
        </div>
      </div>
    );
  }
  const retry = () => {
    setRun((n) => n + 1);
    window.scrollTo({ top: 0 });
  };
  return <Session key={`${call.id}:${run}`} call={call} onRetry={retry} />;
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

/** One scale for live feedback and the coaching recap: 6+ points is good, below 0 is poor, anything else could be better. */
function feedbackKind(points: number) {
  if (points >= 6) return { kind: 'success', Icon: ThumbsUp, verdict: 'Good response' } as const;
  if (points < 0) return { kind: 'danger', Icon: ThumbsDown, verdict: 'Poor response' } as const;
  return { kind: 'warning', Icon: CircleHelp, verdict: 'Could be better' } as const;
}

function callVerdict(score: number): { title: string; tone: 'success' | 'warning' | 'danger' } {
  if (score >= 80) return { title: 'Great call', tone: 'success' };
  if (score >= 60) return { title: 'Decent call', tone: 'warning' };
  return { title: 'This call needs work', tone: 'danger' };
}

function FeedbackCallout({ text, points }: { text: string; points: number }) {
  const { kind, Icon, verdict } = feedbackKind(points);
  return (
    <div className={`callout small ${kind}`} role="status">
      <Icon size={16} aria-hidden />
      <div className="callout-body">
        <strong>{verdict}.</strong> {text}
      </div>
    </div>
  );
}

function Session({ call, onRetry }: { call: CallScenario; onRetry: () => void }) {
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
  const [endedAt, setEndedAt] = useState(0);
  const saved = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLElement>(null);
  const now = useNow();
  const node = nodes.get(nodeId)!;

  // Keep the newest line visible by scrolling the transcript itself, so the page never jumps away from the options.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);
  // When the call ends, bring the result (rendered above the transcript) into view.
  useEffect(() => {
    if (phase !== 'ended') return;
    const el = outcomeRef.current;
    if (!el) return;
    // Align its top below any sticky bar (scroll-margin-top) unless it already sits comfortably in view.
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const top = el.getBoundingClientRect().top;
    if (top < margin || top > window.innerHeight * 0.5) el.scrollIntoView({ block: 'start' });
  }, [phase]);
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
      setEndedAt(Date.now());
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
  const verdict = callVerdict(score);
  const duration = formatClock(((phase === 'ended' ? endedAt : now) - startedAt) / 1000);

  return (
    <div className="page sc-page">
      <PageHeader
        back={BACK}
        title={call.title}
        meta={
          <>
            {phase === 'live' && <LivePill label="On call" />}
            <DifficultyDots d={call.difficulty} showLabel />
            <span className="inline-icon">
              <UserRound size={14} aria-hidden />
              <span>
                {call.caller} · {call.role}
              </span>
            </span>
            <span className="inline-icon" role="timer">
              <Clock size={14} aria-hidden />
              {phase === 'ringing' ? (
                <span>Not answered yet</span>
              ) : (
                <span>
                  {phase === 'ended' ? 'Call length' : 'On call'} <span className="num">{duration}</span>
                </span>
              )}
            </span>
          </>
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
                <span className="pill pill-info sc-ringing-pill">
                  <PhoneIncoming aria-hidden />
                  Ringing
                </span>
                <div className="sc-ringing-who">
                  <h2>{call.caller}</h2>
                  <p className="muted">{call.role}</p>
                </div>
                <p className="sc-ringing-brief">{call.summary}</p>
                <button className="btn btn-primary btn-lg" onClick={answer}>
                  <Phone size={16} aria-hidden />
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
              {phase === 'ended' && (
                <section ref={outcomeRef} className={`card sc-outcome-card sc-outcome-${verdict.tone}`} aria-label="Call result">
                  <div className="sc-outcome">
                    <ScoreRing score={score} label="Call score" />
                    <div className="sc-outcome-body">
                      <h2>{verdict.title}</h2>
                      <p>{node.ending}</p>
                      <div className="row">
                        <Link className="btn btn-primary" to="/calls">
                          <PhoneCall size={16} aria-hidden />
                          More calls
                        </Link>
                        <button className="btn" onClick={onRetry}>
                          <RotateCcw size={16} aria-hidden />
                          Retry this call
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="sc-coaching">
                    <div className="card-head">
                      <h3>
                        Coaching
                      </h3>
                    </div>
                    <ul className="check-list sc-coaching-list">
                      {coaching.map((l, i) => {
                        const { kind, Icon, verdict: label } = feedbackKind(l.points ?? 0);
                        return (
                          <li key={i} className={`sc-coach-${kind}`}>
                            <Icon size={16} role="img" aria-label={label} />
                            <span>{l.feedback}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              )}

              <section className="card sc-transcript">
                <div className="card-head">
                  <h2>
                    Transcript
                  </h2>
                </div>

                <div className="chat" aria-live="polite" ref={chatRef}>
                  {transcript.map((l, i) => (
                    <div key={i} className={`msg ${l.speaker === 'agent' ? 'agent' : 'requester'}`}>
                      <span className="who">{l.speaker === 'agent' ? 'You' : call.caller}</span>
                      {l.text}
                    </div>
                  ))}
                </div>

                {phase === 'live' && (
                  // Phones stack the caller card below the transcript; repeat the mood here so each choice's effect stays visible.
                  <div className="sc-mood-inline">
                    <MoodMeter mood={mood} />
                  </div>
                )}

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

            </>
          )}
        </div>

        <aside className="sc-col">
          <div className="card sc-side-card">
            {phase !== 'ringing' && (
              <div className="sc-caller">
                <div className={`avatar ${speaking ? 'speaking' : ''}`} aria-hidden>
                  {initials(call.caller)}
                </div>
                <div>
                  <strong>{call.caller}</strong>
                  <div className="tiny muted">{call.role}</div>
                </div>
              </div>
            )}
            <div className={phase === 'live' ? 'sc-mood-side-live' : undefined}>
              <MoodMeter mood={mood} />
            </div>
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
                Skills in focus
              </h3>
            </div>
            <div className="sc-skills">
              {call.skills.map((s) => (
                <span key={s} className="pill pill-outline">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
