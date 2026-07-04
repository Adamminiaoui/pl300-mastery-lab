export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "hotspot"
  | "drag_drop"
  | "ordering"
  | "select_place"
  | "yes_no"
  | "case_study";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface DropdownField {
  id: string;
  label: string;
  options: string[];
  correctAnswer: string;
}

export interface DragItem {
  id: string;
  text: string;
}

export interface DropZone {
  id: string;
  label: string;
  correctItemId: string;
}

export interface Question {
  id: number;
  sourcePage: number;
  sourceEndPage?: number;
  type: QuestionType;
  title: string;
  prompt?: string;
  questionText: string;
  rawText: string;
  options: QuestionOption[];
  correctAnswer?: string | null;
  correctAnswers?: string[];
  dropdowns?: DropdownField[];
  dragItems?: DragItem[];
  dropZones?: DropZone[];
  explanation: string;
  references: string[];
  assets: string[];
  tags: string[];
  difficulty: string;
  multipleCorrect: boolean;
  hasImage: boolean;
  manualReview: boolean;
  manualReviewReasons?: string[];
  acceptAnyOrder?: boolean;
  answerFormat: "single" | "multi" | "dropdown" | "drag";
}

export interface QuestionResponse {
  single?: string;
  multi?: string[];
  fields?: Record<string, string>;
}

export interface QuestionScore {
  correct: boolean;
  earnedPoints: number;
  possiblePoints: number;
  expected?: string[];
  received?: string[];
}

export interface SessionResult {
  earnedPoints: number;
  possiblePoints: number;
  percentageScore: number;
  scaledScore: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  breakdown: Record<number, QuestionScore>;
  submittedAt: string;
}

export type SessionMode = "practice" | "exam" | "mock";

export interface PracticeConfig {
  scope: "all" | "range" | "incorrect";
  startId?: number;
  endId?: number;
}

export interface ExamConfig {
  timeLimitMinutes: number;
}

export interface MockConfig {
  timeLimitMinutes: number;
}

export interface QuizSession {
  id: string;
  mode: SessionMode;
  questionIds: number[];
  currentIndex: number;
  startedAt: string;
  updatedAt: string;
  submitted: boolean;
  completedAt?: string;
  timeLimitMinutes?: number;
  timeRemainingSeconds?: number;
  responses: Record<number, QuestionResponse>;
  markedQuestionIds: number[];
  revealedQuestionIds: number[];
  result?: SessionResult;
  configLabel: string;
}

export interface QuestionProgress {
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  lastOutcome?: "correct" | "incorrect";
  lastAnsweredAt?: string;
}

export interface ExamHistoryEntry {
  mode: "exam" | "mock";
  scaledScore: number;
  percentageScore: number;
  correctAnswers: number;
  totalQuestions: number;
  submittedAt: string;
  passed: boolean;
}
