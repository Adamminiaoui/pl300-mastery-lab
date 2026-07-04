import { normalizeComparableText } from "@/lib/helpers";
import type {
  DropZone,
  Question,
  QuestionResponse,
  QuestionScore,
  QuizSession,
  SessionResult,
} from "@/lib/types";

function compareSets(left: string[], right: string[]) {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function getDropZoneTextMap(question: Question) {
  const itemMap = new Map((question.dragItems ?? []).map((item) => [item.id, item.text]));
  return question.dropZones?.reduce<Record<string, string>>((accumulator, zone) => {
    accumulator[zone.id] = itemMap.get(zone.correctItemId) ?? zone.correctItemId;
    return accumulator;
  }, {});
}

export function getPossiblePoints(question: Question) {
  if (question.dropdowns?.length) {
    return question.dropdowns.length;
  }
  if (question.dropZones?.length) {
    return question.dropZones.length;
  }
  return 1;
}

export function scoreQuestion(question: Question, response?: QuestionResponse): QuestionScore {
  const possiblePoints = getPossiblePoints(question);

  if (!response) {
    return { correct: false, earnedPoints: 0, possiblePoints };
  }

  if (question.type === "multiple_choice") {
    const selected = response.multi ?? [];
    const expected = question.correctAnswers ?? [];
    const correct = compareSets(selected, expected);
    return {
      correct,
      earnedPoints: correct ? 1 : 0,
      possiblePoints,
      expected,
      received: selected,
    };
  }

  if (question.dropdowns?.length) {
    let earnedPoints = 0;
    const expected = question.dropdowns.map((dropdown) => dropdown.correctAnswer);
    const received = question.dropdowns.map((dropdown) => response.fields?.[dropdown.id] ?? "");
    question.dropdowns.forEach((dropdown) => {
      if (
        normalizeComparableText(response.fields?.[dropdown.id] ?? "") ===
        normalizeComparableText(dropdown.correctAnswer)
      ) {
        earnedPoints += 1;
      }
    });
    return {
      correct: earnedPoints === possiblePoints,
      earnedPoints,
      possiblePoints,
      expected,
      received,
    };
  }

  if (question.dropZones?.length) {
    let earnedPoints = 0;
    const fields = response.fields ?? {};
    const expectedText = getDropZoneTextMap(question) ?? {};
    const received = question.dropZones.map((zone) => fields[zone.id] ?? "");
    const expected = question.dropZones.map((zone) => expectedText[zone.id] ?? zone.correctItemId);

    question.dropZones.forEach((zone: DropZone) => {
      if ((fields[zone.id] ?? "") === zone.correctItemId) {
        earnedPoints += 1;
      }
    });

    return {
      correct: earnedPoints === possiblePoints,
      earnedPoints,
      possiblePoints,
      expected,
      received,
    };
  }

  if (question.correctAnswers?.length) {
    const selected = response.multi ?? [];
    const correct = compareSets(selected, question.correctAnswers);
    return {
      correct,
      earnedPoints: correct ? 1 : 0,
      possiblePoints,
      expected: question.correctAnswers,
      received: selected,
    };
  }

  const expected = question.correctAnswer ?? "";
  const received = response.single ?? "";
  const correct =
    normalizeComparableText(expected) === normalizeComparableText(received);

  return {
    correct,
    earnedPoints: correct ? 1 : 0,
    possiblePoints,
    expected: [expected],
    received: [received],
  };
}

export function buildSessionResult(session: QuizSession, questions: Question[]): SessionResult {
  let earnedPoints = 0;
  let possiblePoints = 0;
  let correctAnswers = 0;
  const breakdown: Record<number, QuestionScore> = {};

  questions.forEach((question) => {
    const score = scoreQuestion(question, session.responses[question.id]);
    breakdown[question.id] = score;
    earnedPoints += score.earnedPoints;
    possiblePoints += score.possiblePoints;
    if (score.correct) {
      correctAnswers += 1;
    }
  });

  const percentageScore = possiblePoints === 0 ? 0 : (earnedPoints / possiblePoints) * 100;
  const scaledScore = Math.round((earnedPoints / Math.max(possiblePoints, 1)) * 1000);

  return {
    earnedPoints,
    possiblePoints,
    percentageScore,
    scaledScore,
    passed: scaledScore >= 700,
    correctAnswers,
    totalQuestions: questions.length,
    breakdown,
    submittedAt: new Date().toISOString(),
  };
}
