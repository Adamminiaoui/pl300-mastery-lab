import rawQuestions from "@/data/questions.json";
import type { Question, QuestionProgress } from "@/lib/types";

export const questions = rawQuestions as Question[];

export const questionIds = questions.map((question) => question.id);

export const questionMap = new Map<number, Question>(
  questions.map((question) => [question.id, question]),
);

export const topicOptions = Array.from(
  new Set(questions.flatMap((question) => question.tags)),
).sort((left, right) => left.localeCompare(right));

export const questionStats = {
  total: questions.length,
  withImages: questions.filter((question) => question.hasImage).length,
  manualReview: questions.filter((question) => question.manualReview).length,
  byType: questions.reduce<Record<string, number>>((accumulator, question) => {
    accumulator[question.type] = (accumulator[question.type] ?? 0) + 1;
    return accumulator;
  }, {}),
};

export function getQuestion(questionId: number) {
  return questionMap.get(questionId);
}

export function getQuestions(questionList: number[]) {
  return questionList
    .map((questionId) => questionMap.get(questionId))
    .filter((question): question is Question => Boolean(question));
}

export function getIncorrectQuestionIds(progress: Record<number, QuestionProgress>) {
  return Object.entries(progress)
    .filter(([, item]) => item.lastOutcome === "incorrect")
    .map(([questionId]) => Number(questionId))
    .sort((left, right) => left - right);
}
