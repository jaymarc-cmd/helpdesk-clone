import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock,
  Cpu,
  Headset,
  History,
  Lightbulb,
  ListChecks,
  Mic,
  MicOff,
  Play,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Timer,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { INTERVIEW_QUESTIONS } from '../data/interview';
import { pickQuestions, scoreAnswer } from '../engine/interview';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import type { InterviewAnswerResult, InterviewQuestion } from '../types';
import { DifficultyDots, EmptyState, PageHeader, ProgressBar, ScoreRing, StatTile, formatClock, scoreTone, timeAgo, useNow } from '../components/ui';
import { useDictation, useSpeaker } from '../components/speech';
import '../styles/interview-kb.css';

type Cat = InterviewQuestion['category'] | 'Mixed';
const CATS: Cat[] = ['Mixed', 'Technical', 'Troubleshooting', 'Security', 'Customer Service', 'Behavioral'];

const CAT_ICON: Record<Cat, LucideIcon> = {
  Mixed: Shuffle,
  Technical: Cpu,
  Troubleshooting: Wrench,
  Security: ShieldCheck,
  'Customer Service': Headset,
  Behavioral: Users,
};

const COUNT_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: 'Quick' },
  { value: 5, label: 'Standard' },
  { value: 8, label: 'Full' },
];

const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
];

function poolFor(cat: Cat): InterviewQuestion[] {
  return cat === 'Mixed' ? INTERVIEW_QUESTIONS : INTERVIEW_QUESTIONS.filter((q) => q.category === cat);
}

function CategoryPill({ category }: { category: Cat }) {
  const Icon = CAT_ICON[category];
  return (
    <span className="pill pill-primary">
      <Icon aria-hidden />
      {category}
    </span>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function InterviewPage() {
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<'setup' | 'live' | 'done'>('setup');
  const [cat, setCat] = useState<Cat>('Mixed');
  const [count, setCount] = useState(5);
  const [perQ, setPerQ] = useState(180);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [results, setResults] = useState<InterviewAnswerResult[]>([]);

  const start = () => {
    const pool = cat === 'Mixed' ? INTERVIEW_QUESTIONS : INTERVIEW_QUESTIONS.filter((q) => q.category === cat);
    setQuestions(pickQuestions(pool, Math.min(count, pool.length)));
    setResults([]);
    setPhase('live');
  };

  const finish = (all: InterviewAnswerResult[]) => {
    setResults(all);
    setPhase('done');
    const score = Math.round(all.reduce((n, r) => n + r.score, 0) / Math.max(1, all.length));
    dispatch({ type: 'addInterview', attempt: { id: uid('i'), completedAt: new Date().toISOString(), score, answers: all } });
  };

  if (phase === 'live') return <LiveInterview questions={questions} perQ={perQ} onFinish={finish} />;
  if (phase === 'done') return <Results questions={questions} results={results} onAgain={() => setPhase('setup')} />;

  const poolSize = poolFor(cat).length;
  const planned = Math.min(count, poolSize);
  const capped = planned < count;
  const history = [...state.interviews].reverse().slice(0, 10);
  const taken = state.interviews.length;
  const best = taken ? Math.max(...state.interviews.map((i) => i.score)) : null;
  const avg = taken ? Math.round(state.interviews.reduce((n, i) => n + i.score, 0) / taken) : null;
  const voiceOn = state.settings.voice;

  return (
    <div className="iv-page">
      <PageHeader
        eyebrow="Career prep"
        title="Mock interview"
        description="Practice the questions service desk hiring managers actually ask. Type or speak your answers and get feedback on each one."
      />

      <div className="split-main">
        <section className="card iv-setup" aria-labelledby="iv-setup-title">
          <div className="card-head">
            <h2 id="iv-setup-title">
              <SlidersHorizontal size={18} aria-hidden />
              Interview setup
            </h2>
            <span className="pill pill-outline num">{plural(INTERVIEW_QUESTIONS.length, 'question')} in bank</span>
          </div>

          <div className="iv-field">
            <span className="label" id="iv-focus-label">
              Focus area
            </span>
            <div className="seg" role="group" aria-labelledby="iv-focus-label">
              {CATS.map((c) => {
                const Icon = CAT_ICON[c];
                return (
                  <button key={c} type="button" className={cat === c ? 'active' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
                    <Icon size={14} aria-hidden />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="iv-field-pair">
            <div className="iv-field">
              <span className="label" id="iv-count-label">
                Questions
              </span>
              <div className="seg" role="group" aria-labelledby="iv-count-label">
                {COUNT_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={count === o.value ? 'active' : ''} aria-pressed={count === o.value} onClick={() => setCount(o.value)}>
                    <span className="num">{o.value}</span>
                    <span className="iv-seg-sub">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="iv-field">
              <span className="label" id="iv-time-label">
                Time per question
              </span>
              <div className="seg" role="group" aria-labelledby="iv-time-label">
                {TIME_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={perQ === o.value ? 'active' : ''} aria-pressed={perQ === o.value} onClick={() => setPerQ(o.value)}>
                    <span className="num">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="iv-plan-wrap">
            <ul className="iv-plan" aria-label="Interview plan">
              <li>
                <ListChecks size={15} aria-hidden />
                <span className="num">{plural(planned, 'question')}</span>
              </li>
              <li>
                <Clock size={15} aria-hidden />
                <span className="num">{perQ / 60} min each</span>
              </li>
              <li>
                <Timer size={15} aria-hidden />
                <span className="num">Up to {Math.round((planned * perQ) / 60)} min</span>
              </li>
              <li>
                {voiceOn ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
                {voiceOn ? (
                  <span>Questions read aloud</span>
                ) : (
                  <span>
                    Voice off · <Link to="/settings">Turn on in Settings</Link>
                  </span>
                )}
              </li>
            </ul>
            {capped && (
              <p className="small muted iv-note">
                The {cat} bank has {plural(poolSize, 'question')}, so this interview uses all of them.
              </p>
            )}
          </div>

          <div className="callout info">
            <Lightbulb size={16} aria-hidden />
            <div className="callout-body small">
              Answer out loud, the way you would in a real interview. Use <strong>Dictate</strong> to speak your answer (Chrome, Edge and Safari). For
              behavioral questions, structure your answer with <strong>STAR</strong>: Situation, Task, Action, Result.
            </div>
          </div>

          <div className="iv-start">
            <button className="btn btn-primary btn-lg" onClick={start}>
              <Play size={18} aria-hidden />
              Start interview
            </button>
          </div>
        </section>

        <aside className="iv-side">
          <div className="iv-stats">
            <StatTile label="Completed" value={taken} sub={taken === 1 ? 'interview' : 'interviews'} icon={History} tone="neutral" />
            <StatTile
              label="Best score"
              value={best ?? '—'}
              sub={avg !== null ? `Average ${avg}` : 'No scores yet'}
              icon={Trophy}
              tone={best !== null ? scoreTone(best) : 'neutral'}
            />
          </div>

          <section className="card" aria-labelledby="iv-history-title">
            <div className="card-head">
              <h3 id="iv-history-title">
                <ClipboardList size={16} aria-hidden />
                Previous interviews
              </h3>
              {taken > 10 && <span className="tiny muted">Latest 10</span>}
            </div>
            {history.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Questions</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((i) => (
                      <tr key={i.id}>
                        <td>{timeAgo(i.completedAt)}</td>
                        <td className="num">{i.answers.length}</td>
                        <td>
                          <span className={`pill pill-${scoreTone(i.score)}`}>{i.score}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ClipboardList} title="No interviews yet">
                Your score for each mock interview appears here once you finish it.
              </EmptyState>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function LiveInterview({ questions, perQ, onFinish }: { questions: InterviewQuestion[]; perQ: number; onFinish: (r: InterviewAnswerResult[]) => void }) {
  const { state } = useStore();
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<InterviewAnswerResult[]>([]);
  const qStart = useRef(Date.now());
  const now = useNow(500);
  const q = questions[idx];
  const left = perQ - (now - qStart.current) / 1000;
  const { speak, stop, speaking, supported: ttsOk } = useSpeaker(state.settings.voice, state.settings.voiceRate);
  const dict = useDictation((t) => setAnswer((a) => (a ? `${a} ${t}` : t)));

  useEffect(() => {
    qStart.current = Date.now();
    speak(q.question, { pitch: 1, rate: 1 });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const next = (skipped = false) => {
    dict.stop();
    const r = scoreAnswer(q, skipped ? '' : answer, Math.round((Date.now() - qStart.current) / 1000));
    const all = [...results, r];
    setResults(all);
    setAnswer('');
    if (idx + 1 >= questions.length) onFinish(all);
    else setIdx(idx + 1);
  };

  // Auto-advance when time runs out.
  useEffect(() => {
    if (left <= 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);

  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const last = idx + 1 >= questions.length;

  return (
    <div className="iv-page iv-live">
      <PageHeader
        eyebrow="Mock interview in progress"
        title={
          <>
            Question {idx + 1} <span className="iv-of">of {questions.length}</span>
          </>
        }
        actions={
          <span className={`timer ${left < 30 ? 'over' : ''}`} role="timer" aria-label={`Time left: ${formatClock(left)}`}>
            <Clock size={16} aria-hidden />
            {formatClock(left)}
          </span>
        }
      />

      <div className="iv-progress">
        <ProgressBar value={idx / questions.length} />
        <span className="tiny muted num">
          {idx} of {questions.length} answered
        </span>
      </div>

      <section className="card iv-qcard" aria-labelledby="iv-question">
        <div className="iv-asker">
          <div className={`avatar iv-avatar ${speaking ? 'speaking' : ''}`} aria-hidden>
            HM
          </div>
          <div className="iv-asker-body">
            <div className="iv-asker-meta">
              <span className="label">Hiring manager</span>
              <CategoryPill category={q.category} />
              <DifficultyDots d={q.difficulty} showLabel />
            </div>
            <h2 id="iv-question" className="iv-question">
              {q.question}
            </h2>
          </div>
        </div>

        <div className="iv-answer">
          <div className="iv-answer-head">
            <label className="label" htmlFor="iv-answer-input">
              Your answer
            </label>
            {dict.listening && (
              <span className="pill pill-danger iv-listening">
                <span className="iv-rec-dot" aria-hidden />
                Listening
              </span>
            )}
          </div>
          <textarea
            id="iv-answer-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={9}
            placeholder="Type your answer as you would say it…"
            autoFocus
          />
        </div>

        <div className="iv-toolbar">
          <div className="iv-tools">
            {dict.supported && (
              <button className={`btn btn-sm ${dict.listening ? 'btn-danger' : ''}`} onClick={() => (dict.listening ? dict.stop() : dict.start())}>
                {dict.listening ? <MicOff size={15} aria-hidden /> : <Mic size={15} aria-hidden />}
                {dict.listening ? 'Stop dictation' : 'Dictate'}
              </button>
            )}
            {ttsOk && state.settings.voice && (
              <button className="btn btn-sm" onClick={() => speak(q.question)}>
                <Repeat size={15} aria-hidden />
                Repeat question
              </button>
            )}
            <span className="tiny muted num iv-words" aria-live="polite">
              {plural(words, 'word')}
            </span>
          </div>
          <div className="iv-nav">
            <button
              className="btn btn-ghost"
              onClick={() => next(true)}
            >
              <SkipForward size={16} aria-hidden />
              Skip
            </button>
            <button className="btn btn-primary" onClick={() => next()}>
              {last ? 'Finish' : 'Next question'}
              {last ? <Check size={16} aria-hidden /> : <ArrowRight size={16} aria-hidden />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Results({ questions, results, onAgain }: { questions: InterviewQuestion[]; results: InterviewAnswerResult[]; onAgain: () => void }) {
  const score = Math.round(results.reduce((n, r) => n + r.score, 0) / Math.max(1, results.length));
  const verdict = score >= 80 ? 'Strong candidate. You hit the key points clearly.' : score >= 60 ? 'Good foundation. Add more structure and specifics.' : 'Keep practicing. Review the sample answers below.';
  const tone = scoreTone(score);
  const rating = score >= 80 ? 'Strong' : score >= 60 ? 'Developing' : 'Needs practice';
  const matched = results.reduce((n, r) => n + r.matched.length, 0);
  const totalPoints = results.reduce((n, r) => n + r.matched.length + r.missed.length, 0);
  const answered = results.filter((r) => r.answer.trim()).length;
  const seconds = results.reduce((n, r) => n + r.seconds, 0);

  return (
    <div className="iv-page">
      <PageHeader
        eyebrow="Mock interview results"
        title="Interview feedback"
        description={verdict}
        actions={
          <button className="btn btn-primary" onClick={onAgain}>
            <RotateCcw size={16} aria-hidden />
            New interview
          </button>
        }
      />

      <section className="card iv-overview" aria-label="Overall result">
        <ScoreRing score={score} label="Overall" />
        <div className="iv-overview-body">
          <div className="iv-overview-title">
            <span className={`pill pill-${tone}`}>{rating}</span>
            <span className="small muted">
              {plural(results.length, 'question')} reviewed
            </span>
          </div>
          <dl className="iv-figures">
            <div>
              <dt className="label">Key points covered</dt>
              <dd className="num">
                {matched}
                <span className="faint"> / {totalPoints}</span>
              </dd>
            </div>
            <div>
              <dt className="label">Answered</dt>
              <dd className="num">
                {answered}
                <span className="faint"> / {results.length}</span>
              </dd>
            </div>
            <div>
              <dt className="label">Time used</dt>
              <dd className="num">{formatClock(seconds)}</dd>
            </div>
          </dl>
          <p className="small muted iv-overview-note">
            Scores reflect how many key points your answer covered. Real interviewers also judge delivery, so practice saying these out loud.
          </p>
        </div>
      </section>

      {results.map((r, i) => {
        const q = questions.find((x) => x.id === r.questionId)!;
        const rTone = scoreTone(r.score);
        return (
          <article key={r.questionId} className="card iv-result" aria-labelledby={`iv-r-${i}`}>
            <header className="iv-result-head">
              <span className="iv-qnum mono" aria-hidden>
                Q{i + 1}
              </span>
              <div className="iv-result-title">
                <h3 id={`iv-r-${i}`}>{q.question}</h3>
                <div className="iv-result-meta">
                  <CategoryPill category={q.category} />
                  <span className="inline-icon tiny muted num">
                    <Clock size={13} aria-hidden />
                    {formatClock(r.seconds)}
                  </span>
                  {!r.answer && <span className="pill pill-outline">Skipped</span>}
                </div>
              </div>
              <span className={`pill pill-${rTone} iv-score`} aria-label={`Score ${r.score} out of 100`}>
                {r.score}
              </span>
            </header>

            <div className="grid grid-2">
              <div className="iv-col">
                <div className="iv-block">
                  <span className="label">Your answer</span>
                  {r.answer ? <p className="small iv-answer-text">{r.answer}</p> : <p className="small faint iv-answer-text">No answer recorded.</p>}
                </div>
                <div className="iv-block">
                  <span className="label num">
                    Key points {r.matched.length} / {r.matched.length + r.missed.length}
                  </span>
                  <ul className="check-list">
                    {r.matched.map((m) => (
                      <li key={m}>
                        <Check size={15} className="ok" aria-hidden />
                        <span>
                          <span className="iv-sr">Covered: </span>
                          {m}
                        </span>
                      </li>
                    ))}
                    {r.missed.map((m) => (
                      <li key={m} className="iv-missed">
                        <X size={15} className="no" aria-hidden />
                        <span>
                          <span className="iv-sr">Missed: </span>
                          {m}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="iv-col">
                <div className="iv-block">
                  <span className="label">Sample strong answer</span>
                  <p className="small iv-answer-text">{q.sampleAnswer}</p>
                </div>
                <div className="callout iv-tip">
                  <Lightbulb size={16} aria-hidden />
                  <div className="callout-body small">{q.tip}</div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
