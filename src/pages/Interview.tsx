import { useEffect, useRef, useState } from 'react';
import { INTERVIEW_QUESTIONS } from '../data/interview';
import { pickQuestions, scoreAnswer } from '../engine/interview';
import { useStore } from '../state/store';
import { uid } from '../state/storage';
import type { InterviewAnswerResult, InterviewQuestion } from '../types';
import { ProgressBar, ScoreRing, formatClock, scoreTone, timeAgo, useNow } from '../components/ui';
import { useDictation, useSpeaker } from '../components/speech';

type Cat = InterviewQuestion['category'] | 'Mixed';
const CATS: Cat[] = ['Mixed', 'Technical', 'Troubleshooting', 'Security', 'Customer Service', 'Behavioral'];

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

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Mock Interview</h1>
          <p>Practice the questions service desk hiring managers actually ask. Type or speak your answers and get instant feedback.</p>
        </div>
      </div>
      <div className="card stack" style={{ maxWidth: 640 }}>
        <label className="field">
          Focus area
          <select value={cat} onChange={(e) => setCat(e.target.value as Cat)}>
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-2">
          <label className="field">
            Questions
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              <option value={3}>3 (quick)</option>
              <option value={5}>5</option>
              <option value={8}>8 (full interview)</option>
            </select>
          </label>
          <label className="field">
            Time per question
            <select value={perQ} onChange={(e) => setPerQ(Number(e.target.value))}>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </label>
        </div>
        <div className="callout small">
          Tip: answer out loud as you would in a real interview. Use the 🎤 button to dictate (Chrome, Edge, Safari). Use the STAR method
          (Situation, Task, Action, Result) for behavioral questions.
        </div>
        <button className="btn btn-primary btn-lg" onClick={start}>
          Start interview
        </button>
      </div>

      {state.interviews.length > 0 && (
        <div className="card">
          <h3>Previous interviews</h3>
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
                {[...state.interviews].reverse().slice(0, 10).map((i) => (
                  <tr key={i.id}>
                    <td>{timeAgo(i.completedAt)}</td>
                    <td>{i.answers.length}</td>
                    <td>
                      <span className={`pill pill-${scoreTone(i.score)}`}>{i.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  const { speak, stop, supported: ttsOk } = useSpeaker(state.settings.voice, state.settings.voiceRate);
  const dict = useDictation((t) => setAnswer((a) => (a ? `${a} ${t}` : t)));

  useEffect(() => {
    qStart.current = Date.now();
    speak(q.question, { pitch: 1, rate: 1 });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const next = () => {
    dict.stop();
    const r = scoreAnswer(q, answer, Math.round((Date.now() - qStart.current) / 1000));
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

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 860 }}>
      <div className="spread">
        <div>
          <div className="small muted">
            Question {idx + 1} of {questions.length} · {q.category}
          </div>
          <ProgressBar value={idx / questions.length} />
        </div>
        <span className={`timer ${left < 30 ? 'over' : ''}`}>⏱ {formatClock(left)}</span>
      </div>
      <div className="card stack">
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: '0.9rem' }}>
            HM
          </div>
          <div>
            <div className="tiny muted">Hiring manager</div>
            <h2 style={{ margin: 0 }}>{q.question}</h2>
          </div>
        </div>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} placeholder="Type your answer as you would say it…" autoFocus />
        <div className="spread">
          <div className="row">
            {dict.supported && (
              <button className={`btn btn-sm ${dict.listening ? 'btn-danger' : ''}`} onClick={() => (dict.listening ? dict.stop() : dict.start())}>
                {dict.listening ? '⏹ Stop dictation' : '🎤 Dictate'}
              </button>
            )}
            {ttsOk && state.settings.voice && (
              <button className="btn btn-sm" onClick={() => speak(q.question)}>
                🔁 Repeat question
              </button>
            )}
            <span className="tiny muted">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => { setAnswer(''); next(); }}>
              Skip
            </button>
            <button className="btn btn-primary" onClick={next}>
              {idx + 1 >= questions.length ? 'Finish' : 'Next question →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Results({ questions, results, onAgain }: { questions: InterviewQuestion[]; results: InterviewAnswerResult[]; onAgain: () => void }) {
  const score = Math.round(results.reduce((n, r) => n + r.score, 0) / Math.max(1, results.length));
  const verdict = score >= 80 ? 'Strong candidate. You hit the key points clearly.' : score >= 60 ? 'Good foundation. Add more structure and specifics.' : 'Keep practicing. Review the sample answers below.';
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Interview feedback</h1>
          <p>{verdict}</p>
        </div>
        <button className="btn btn-primary" onClick={onAgain}>
          New interview
        </button>
      </div>
      <div className="card row" style={{ gap: 24 }}>
        <ScoreRing score={score} label="Overall" />
        <p className="muted" style={{ flex: '1 1 260px', margin: 0 }}>
          Scores reflect how many key points your answer covered. Real interviewers also judge delivery, so practice saying these out loud.
        </p>
      </div>
      {results.map((r, i) => {
        const q = questions.find((x) => x.id === r.questionId)!;
        return (
          <div key={r.questionId} className="card stack">
            <div className="spread">
              <strong>
                Q{i + 1}. {q.question}
              </strong>
              <span className={`pill pill-${scoreTone(r.score)}`}>{r.score}</span>
            </div>
            <div className="grid grid-2">
              <div>
                <div className="tiny muted mb" style={{ marginBottom: 4 }}>
                  YOUR ANSWER
                </div>
                <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                  {r.answer || <em className="muted">(skipped)</em>}
                </p>
                <ul className="check-list">
                  {r.matched.map((m) => (
                    <li key={m}>
                      <span className="ok">✓</span>
                      {m}
                    </li>
                  ))}
                  {r.missed.map((m) => (
                    <li key={m}>
                      <span className="no">✗</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="tiny muted mb" style={{ marginBottom: 4 }}>
                  SAMPLE STRONG ANSWER
                </div>
                <p className="small">{q.sampleAnswer}</p>
                <div className="callout small">💡 {q.tip}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
