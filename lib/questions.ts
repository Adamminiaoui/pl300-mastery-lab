import rawQuestions from "@/data/questions.json";
import { shuffleArray } from "@/lib/helpers";
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

export type ExamSkillDomain = "prepare" | "model" | "visualize" | "manage";

export const examBlueprint: Array<{
  id: ExamSkillDomain;
  label: string;
  percentageRange: string;
  questionCount: number;
}> = [
  {
    id: "prepare",
    label: "Prepare the data",
    percentageRange: "25-30%",
    questionCount: 16,
  },
  {
    id: "model",
    label: "Model the data",
    percentageRange: "25-30%",
    questionCount: 16,
  },
  {
    id: "visualize",
    label: "Visualize and analyze the data",
    percentageRange: "25-30%",
    questionCount: 16,
  },
  {
    id: "manage",
    label: "Manage and secure Power BI",
    percentageRange: "15-20%",
    questionCount: 12,
  },
];

const domainPriority = examBlueprint.map((item) => item.id);

const domainKeywords: Record<ExamSkillDomain, string[]> = {
  prepare: [
    "get or connect to data",
    "connect to data",
    "data source",
    "shared semantic model",
    "credentials",
    "privacy level",
    "power query",
    "query editor",
    "directlake",
    "directquery",
    "import mode",
    "parameter",
    "profile",
    "clean",
    "null values",
    "data quality",
    "data type",
    "transform",
    "group and aggregate",
    "pivot",
    "unpivot",
    "transpose",
    "semi-structured",
    "fact table",
    "dimension table",
    "reference query",
    "duplicate query",
    "merge queries",
    "append queries",
    "data loading",
    "load the data",
  ],
  model: [
    "data model",
    "relationship",
    "cardinality",
    "cross-filter",
    "date table",
    "role-playing",
    "calculated column",
    "calculated table",
    "measure",
    "dax",
    "calculate",
    "time intelligence",
    "semi-additive",
    "quick measure",
    "calculation group",
    "performance analyzer",
    "granularity",
    "star schema",
    "snowflake",
    "model performance",
  ],
  visualize: [
    "visual",
    "report page",
    "report",
    "dashboard",
    "theme",
    "conditional formatting",
    "slicer",
    "filter",
    "paginated report",
    "bookmark",
    "tooltip",
    "interaction",
    "navigation",
    "sorting",
    "sync slicer",
    "drillthrough",
    "export",
    "mobile",
    "accessibility",
    "automatic page refresh",
    "analyze",
    "binning",
    "clustering",
    "ai visual",
    "reference line",
    "forecasting",
    "outlier",
    "anomaly",
  ],
  manage: [
    "workspace",
    "app",
    "publish",
    "subscription",
    "data alert",
    "promote",
    "certify",
    "gateway",
    "scheduled refresh",
    "semantic model",
    "row-level security",
    "rls",
    "workspace role",
    "access",
    "build permission",
    "sensitivity label",
    "secure",
    "govern",
    "distribution method",
  ],
};

function scoreQuestionDomain(question: Question) {
  const scores: Record<ExamSkillDomain, number> = {
    prepare: 0,
    model: 0,
    visualize: 0,
    manage: 0,
  };
  const tags = new Set(question.tags);
  const searchCorpus = `${question.questionText} ${question.rawText} ${question.tags.join(" ")}`
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (tags.has("Power Query")) {
    scores.prepare += 6;
  }
  if (tags.has("Import")) {
    scores.prepare += 4;
  }
  if (tags.has("DirectQuery")) {
    scores.prepare += 3;
    scores.model += 2;
  }
  if (tags.has("Dataflows")) {
    scores.prepare += 3;
  }
  if (tags.has("Modeling")) {
    scores.model += 6;
  }
  if (tags.has("DAX")) {
    scores.model += 6;
  }
  if (tags.has("Visualization")) {
    scores.visualize += 5;
  }
  if (tags.has("Security")) {
    scores.manage += 6;
  }
  if (tags.has("Power BI Service")) {
    scores.manage += 5;
  }
  if (tags.has("Gateway")) {
    scores.manage += 5;
  }
  if (tags.has("Refresh")) {
    scores.manage += 3;
  }
  if (tags.has("Service")) {
    scores.manage += 2;
  }

  for (const [domain, keywords] of Object.entries(domainKeywords) as Array<
    [ExamSkillDomain, string[]]
  >) {
    for (const keyword of keywords) {
      if (searchCorpus.includes(keyword)) {
        scores[domain] += 1;
      }
    }
  }

  const topScore = Math.max(...Object.values(scores));
  const matchingDomains = domainPriority.filter((domain) => scores[domain] === topScore);
  return matchingDomains[0] ?? "visualize";
}

export const questionDomainMap = new Map<number, ExamSkillDomain>(
  questions.map((question) => [question.id, scoreQuestionDomain(question)]),
);

export const questionIdsByExamDomain = examBlueprint.reduce<Record<ExamSkillDomain, number[]>>(
  (accumulator, item) => {
    accumulator[item.id] = questions
      .filter((question) => questionDomainMap.get(question.id) === item.id)
      .map((question) => question.id);
    return accumulator;
  },
  {
    prepare: [],
    model: [],
    visualize: [],
    manage: [],
  },
);

export function buildWeightedExamQuestionIds(totalQuestions = 60, seed = Date.now()) {
  const selectedIds: number[] = [];
  const selectedIdSet = new Set<number>();

  examBlueprint.forEach((domain, index) => {
    const candidates = questionIdsByExamDomain[domain.id].filter(
      (questionId) => !selectedIdSet.has(questionId),
    );
    const picked = shuffleArray(candidates, seed + (index + 1) * 977).slice(
      0,
      domain.questionCount,
    );

    picked.forEach((questionId) => {
      selectedIdSet.add(questionId);
      selectedIds.push(questionId);
    });
  });

  if (selectedIds.length < totalQuestions) {
    const remainder = shuffleArray(questionIds, seed + 7919).filter(
      (questionId) => !selectedIdSet.has(questionId),
    );
    remainder.slice(0, totalQuestions - selectedIds.length).forEach((questionId) => {
      selectedIdSet.add(questionId);
      selectedIds.push(questionId);
    });
  }

  return shuffleArray(selectedIds.slice(0, totalQuestions), seed + 12345);
}

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
