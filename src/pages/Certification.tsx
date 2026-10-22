import { Link, useParams } from 'react-router-dom';
import { Award, CircleCheck, CircleX, Play, Printer } from 'lucide-react';
import { BUILTIN_SCENARIOS } from '../data/scenarios';
import { bestByScenario } from '../engine/progress';
import { EXAM_PASS_AVG, EXAM_PASS_MIN, EXAM_SIZE, examResult, pickExam } from '../engine/coach';
import { useStore } from '../state/store';
import { CategoryPill, DifficultyDots, EmptyState, PageHeader, formatDate, scoreTone, ticketNumber } from '../components/ui';
import '../styles/workstation.css';

/** Certification: five tickets across five categories, no hints, graded together. */
export function CertificationPage() {
  const { id } = useParams();
  return id ? <CertificateView id={id} /> : <ExamHome />;
}

function ExamHome() {
  const { state, dispatch, getScenario, works } = useStore();
  const exam = state.exam;
  const scores = exam ? exam.scenarioIds.flatMap((sid) => state.tickets.filter((t) => t.id === exam.attempts[sid]).map((t) => t.result.total)) : [];
  const result = examResult(scores);

  // Built-in scenarios only: custom ones may not be balanced for an exam.
  const start = () => dispatch({ type: 'startExam', scenarioIds: pickExam(BUILTIN_SCENARIOS, bestByScenario(state), Date.now() % 9973) });

  return (
    <div className="page">
      <PageHeader
        title="Certification"
        description={`Prove you can run the desk on your own: ${EXAM_SIZE} tickets from ${EXAM_SIZE} categories, no hints and no coach. Pass with an average of ${EXAM_PASS_AVG} and no ticket below ${EXAM_PASS_MIN}.`}
      />

      {!exam ? (
        <section className="card cert-start">
          <div>
            <h2>Tier 1 Service Desk Analyst exam</h2>
            <p className="muted">
              Tickets are picked across categories and difficulties, favouring ones you haven't passed yet. Work them in any order; they are graded exactly like
              practice tickets. You can have up to three open at once.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={start}>
            <Play size={16} aria-hidden />
            Start the exam
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="card-head">
            <h2>Your exam</h2>
            <span className="pill num">
              {scores.length} of {exam.scenarioIds.length} done
            </span>
          </div>
          <ol className="cert-list">
            {exam.scenarioIds.map((sid) => {
              const sc = getScenario(sid);
              if (!sc) return null;
              const attempt = state.tickets.find((t) => t.id === exam.attempts[sid]);
              const open = works.some((w) => w.scenario.id === sid);
              return (
                <li key={sid}>
                  <span className="cert-ticket">
                    <span className="mono">{ticketNumber(sid)}</span> <strong>{sc.title}</strong>
                    <span className="cert-meta">
                      <CategoryPill category={sc.category} />
                      <DifficultyDots d={sc.difficulty} showLabel />
                    </span>
                  </span>
                  {attempt ? (
                    <Link to={`/review/${attempt.id}`} className={`pill pill-${scoreTone(attempt.result.total)} num`}>
                      {attempt.result.total}
                    </Link>
                  ) : (
                    <Link to={`/ticket/${sid}?mode=exam`} className="btn btn-sm">
                      {open ? 'Continue' : 'Start'}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
          {result.complete ? (
            <div className={`callout ${result.passed ? 'success' : 'warning'}`}>
              {result.passed ? <CircleCheck size={18} aria-hidden /> : <CircleX size={18} aria-hidden />}
              <div className="callout-body">
                <strong>{result.passed ? 'Passed.' : 'Not this time.'}</strong> Average {result.avg}, lowest {result.min}.{' '}
                {result.passed ? 'Claim your certificate.' : `You need an average of ${EXAM_PASS_AVG} and nothing below ${EXAM_PASS_MIN}. Review the tickets and try again.`}
              </div>
            </div>
          ) : null}
          <div className="row cert-actions">
            {result.complete && result.passed ? (
              <button
                className="btn btn-primary"
                onClick={() =>
                  dispatch({
                    type: 'endExam',
                    certificate: { id: exam.id, passedAt: new Date().toISOString(), avg: result.avg, scores },
                  })
                }
              >
                <Award size={16} aria-hidden />
                Claim certificate
              </button>
            ) : (
              <button className="btn" onClick={() => dispatch({ type: 'endExam' })}>
                {result.complete ? 'Finish' : 'Abandon exam'}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Certificates</h2>
        </div>
        {state.certificates.length === 0 ? (
          <EmptyState icon={Award} title="No certificates yet">
            Pass the exam to earn your first one.
          </EmptyState>
        ) : (
          <ul className="cert-list">
            {state.certificates.map((c) => (
              <li key={c.id}>
                <span className="cert-ticket">
                  <strong>Tier 1 Service Desk Analyst</strong>
                  <span className="muted">
                    Passed {formatDate(c.passedAt)} · average {c.avg}
                  </span>
                </span>
                <Link to={`/certification/${c.id}`} className="btn btn-sm">
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CertificateView({ id }: { id: string }) {
  const { state } = useStore();
  const cert = state.certificates.find((c) => c.id === id);
  if (!cert)
    return (
      <div className="page">
        <PageHeader back={{ to: '/certification', label: 'Certification' }} title="Certificate not found" />
      </div>
    );
  return (
    <div className="page">
      <PageHeader
        back={{ to: '/certification', label: 'Certification' }}
        title="Certificate"
        actions={
          <button className="btn print-btn" onClick={() => window.print()}>
            <Printer size={16} aria-hidden />
            Print
          </button>
        }
      />
      <article className="card cert-paper">
        <Award size={40} className="cert-seal" aria-hidden />
        <p className="cert-kicker">TierOne IT Support Simulator certifies that</p>
        <h2 className="cert-name">{state.profile?.name ?? 'Analyst'}</h2>
        <p>
          passed the <strong>Tier 1 Service Desk Analyst</strong> exam on {formatDate(cert.passedAt)}, handling {cert.scores.length} live tickets
          across accounts, networks, hardware, software, email and security with an average score of <strong>{cert.avg}</strong>.
        </p>
        <p className="cert-scores num">Ticket scores: {cert.scores.join(' · ')}</p>
        <p className="cert-id mono">Certificate {cert.id}</p>
      </article>
    </div>
  );
}

