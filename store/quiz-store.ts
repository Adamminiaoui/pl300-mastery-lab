"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createId } from "@/lib/helpers";
import {
  buildWeightedExamQuestionIds,
  getIncorrectQuestionIds,
  getQuestions,
  questionIds,
} from "@/lib/questions";
import { buildSessionResult, scoreQuestion } from "@/lib/scoring";
import type {
  ExamConfig,
  ExamHistoryEntry,
  MockConfig,
  PracticeConfig,
  QuestionProgress,
  QuestionResponse,
  QuizSession,
  SessionMode,
  SessionResult,
} from "@/lib/types";

interface QuizStoreState {
  theme: "light" | "dark";
  sessions: Partial<Record<SessionMode, QuizSession>>;
  questionProgress: Record<number, QuestionProgress>;
  examHistory: ExamHistoryEntry[];
  setTheme: (theme: "light" | "dark") => void;
  startPracticeSession: (config: PracticeConfig) => QuizSession;
  startExamSession: (config: ExamConfig) => QuizSession;
  startMockSession: (config: MockConfig) => QuizSession;
  clearSession: (mode: SessionMode) => void;
  jumpToQuestion: (mode: SessionMode, index: number) => void;
  moveQuestion: (mode: SessionMode, delta: number) => void;
  saveResponse: (mode: SessionMode, questionId: number, response: QuestionResponse) => void;
  toggleMarked: (mode: SessionMode, questionId: number) => void;
  recordQuestionOutcome: (questionId: number, correct: boolean) => void;
  revealPracticeAnswer: (questionId: number) => QuestionResponse | undefined;
  submitSession: (mode: "exam" | "mock") => SessionResult | undefined;
  setTimeRemaining: (mode: "exam" | "mock", nextValue: number) => void;
}

function createProgressEntry(previous?: QuestionProgress): QuestionProgress {
  return (
    previous ?? {
      attempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
    }
  );
}

function updateProgress(
  current: Record<number, QuestionProgress>,
  questionId: number,
  correct: boolean,
) {
  const next = { ...current };
  const previous = createProgressEntry(next[questionId]);
  next[questionId] = {
    attempts: previous.attempts + 1,
    correctAttempts: previous.correctAttempts + (correct ? 1 : 0),
    incorrectAttempts: previous.incorrectAttempts + (correct ? 0 : 1),
    lastOutcome: correct ? "correct" : "incorrect",
    lastAnsweredAt: new Date().toISOString(),
  };
  return next;
}

function createSession(
  mode: SessionMode,
  ids: number[],
  configLabel: string,
  timeLimitMinutes?: number,
): QuizSession {
  const now = new Date().toISOString();
  return {
    id: createId(mode),
    mode,
    questionIds: ids,
    currentIndex: 0,
    startedAt: now,
    updatedAt: now,
    submitted: false,
    timeLimitMinutes,
    timeRemainingSeconds: timeLimitMinutes ? timeLimitMinutes * 60 : undefined,
    responses: {},
    markedQuestionIds: [],
    revealedQuestionIds: [],
    configLabel,
  };
}

export const useQuizStore = create<QuizStoreState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sessions: {},
      questionProgress: {},
      examHistory: [],
      setTheme(theme) {
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = theme;
        }
        set({ theme });
      },
      startPracticeSession(config) {
        const incorrectIds = getIncorrectQuestionIds(get().questionProgress);
        let ids = [...questionIds];
        let label = "All 301 questions";

        if (config.scope === "range" && config.startId && config.endId) {
          ids = questionIds.filter(
            (questionId) => questionId >= config.startId! && questionId <= config.endId!,
          );
          label = `Questions ${config.startId} to ${config.endId}`;
        }
        if (config.scope === "incorrect") {
          ids = incorrectIds.length > 0 ? incorrectIds : [...questionIds];
          label = incorrectIds.length > 0 ? "Incorrect questions only" : "All questions";
        }

        const session = createSession("practice", ids, label);
        set((state) => ({
          sessions: {
            ...state.sessions,
            practice: session,
          },
        }));
        return session;
      },
      startExamSession(config) {
        const session = createSession(
          "exam",
          buildWeightedExamQuestionIds(60),
          "PL-300 weighted 60-question exam",
          config.timeLimitMinutes,
        );
        set((state) => ({
          sessions: {
            ...state.sessions,
            exam: session,
          },
        }));
        return session;
      },
      startMockSession(config) {
        const session = createSession(
          "mock",
          [...questionIds],
          "Full 301-question mock",
          config.timeLimitMinutes,
        );
        set((state) => ({
          sessions: {
            ...state.sessions,
            mock: session,
          },
        }));
        return session;
      },
      clearSession(mode) {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [mode]: undefined,
          },
        }));
      },
      jumpToQuestion(mode, index) {
        set((state) => {
          const session = state.sessions[mode];
          if (!session) {
            return state;
          }
          const nextIndex = Math.min(Math.max(index, 0), session.questionIds.length - 1);
          return {
            sessions: {
              ...state.sessions,
              [mode]: {
                ...session,
                currentIndex: nextIndex,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      moveQuestion(mode, delta) {
        const session = get().sessions[mode];
        if (!session) {
          return;
        }
        get().jumpToQuestion(mode, session.currentIndex + delta);
      },
      saveResponse(mode, questionId, response) {
        set((state) => {
          const session = state.sessions[mode];
          if (!session) {
            return state;
          }

          const responses = {
            ...session.responses,
            [questionId]: response,
          };

          const revealedQuestionIds =
            mode === "practice"
              ? session.revealedQuestionIds.filter((value) => value !== questionId)
              : session.revealedQuestionIds;

          return {
            sessions: {
              ...state.sessions,
              [mode]: {
                ...session,
                responses,
                revealedQuestionIds,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      toggleMarked(mode, questionId) {
        set((state) => {
          const session = state.sessions[mode];
          if (!session) {
            return state;
          }
          const marked = session.markedQuestionIds.includes(questionId)
            ? session.markedQuestionIds.filter((value) => value !== questionId)
            : [...session.markedQuestionIds, questionId];
          return {
            sessions: {
              ...state.sessions,
              [mode]: {
                ...session,
                markedQuestionIds: marked,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      recordQuestionOutcome(questionId, correct) {
        set((state) => ({
          questionProgress: updateProgress(state.questionProgress, questionId, correct),
        }));
      },
      revealPracticeAnswer(questionId) {
        const state = get();
        const session = state.sessions.practice;
        if (!session) {
          return undefined;
        }
        const question = getQuestions([questionId])[0];
        const response = session.responses[questionId];
        if (!question || !response) {
          return undefined;
        }

        const score = scoreQuestion(question, response);
        set((current) => ({
          questionProgress: updateProgress(current.questionProgress, questionId, score.correct),
          sessions: {
            ...current.sessions,
            practice: {
              ...session,
              revealedQuestionIds: session.revealedQuestionIds.includes(questionId)
                ? session.revealedQuestionIds
                : [...session.revealedQuestionIds, questionId],
              updatedAt: new Date().toISOString(),
            },
          },
        }));
        return response;
      },
      submitSession(mode) {
        const session = get().sessions[mode];
        if (!session) {
          return undefined;
        }
        const questions = getQuestions(session.questionIds);
        const result = buildSessionResult(session, questions);

        set((state) => {
          let nextProgress = { ...state.questionProgress };
          questions.forEach((question) => {
            const score = result.breakdown[question.id];
            if (!session.responses[question.id]) {
              return;
            }
            nextProgress = updateProgress(nextProgress, question.id, score.correct);
          });

          return {
            questionProgress: nextProgress,
            examHistory: [
              {
                mode,
                scaledScore: result.scaledScore,
                percentageScore: result.percentageScore,
                correctAnswers: result.correctAnswers,
                totalQuestions: result.totalQuestions,
                submittedAt: result.submittedAt,
                passed: result.passed,
              },
              ...state.examHistory,
            ].slice(0, 12),
            sessions: {
              ...state.sessions,
              [mode]: {
                ...session,
                submitted: true,
                completedAt: result.submittedAt,
                result,
                revealedQuestionIds: session.questionIds,
                updatedAt: result.submittedAt,
              },
            },
          };
        });
        return result;
      },
      setTimeRemaining(mode, nextValue) {
        set((state) => {
          const session = state.sessions[mode];
          if (!session) {
            return state;
          }
          return {
            sessions: {
              ...state.sessions,
              [mode]: {
                ...session,
                timeRemainingSeconds: Math.max(nextValue, 0),
              },
            },
          };
        });
      },
    }),
    {
      name: "pl300-exam-simulator-store",
      partialize: (state) => ({
        theme: state.theme,
        sessions: state.sessions,
        questionProgress: state.questionProgress,
        examHistory: state.examHistory,
      }),
    },
  ),
);
