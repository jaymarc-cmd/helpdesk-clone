import type { InterviewAnswerResult, InterviewQuestion } from '../types';

export function scoreAnswer(q: InterviewQuestion, answer: string, seconds: number): InterviewAnswerResult {
  const text = answer.toLowerCase();
  const matched: string[] = [];
  const missed: string[] = [];
  for (const kp of q.keyPoints) {
    if (kp.keywords.some((k) => text.includes(k.toLowerCase()))) matched.push(kp.label);
    else missed.push(kp.label);
  }
  let score = q.keyPoints.length ? Math.round((matched.length / q.keyPoints.length) * 100) : 0;
  // Keyword-stuffed one-liners shouldn't score well.
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 20) score = Math.min(score, 40);
  return { questionId: q.id, answer, matched, missed, score, seconds };
}

export function pickQuestions(pool: InterviewQuestion[], count: number, rnd: () => number = Math.random): InterviewQuestion[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}
