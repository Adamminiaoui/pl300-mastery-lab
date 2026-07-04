import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(rootDir, "data", "questions.json");
const outputPath = path.join(rootDir, "data", "question-audit-report.json");

const questions = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function pushCheck(checks, ok, code, details) {
  checks.push({ ok, code, details });
}

function getMaxExplanationBox(question) {
  const matches = [...String(question.explanation ?? "").matchAll(/Box\s+(\d+)\s*:/gi)];
  return matches.length ? Math.max(...matches.map((match) => Number(match[1]))) : 0;
}

function auditQuestion(question) {
  const checks = [];
  const optionIds = new Set((question.options ?? []).map((option) => option.id));
  const optionTexts = (question.options ?? []).map((option) => normalize(option.text));
  const dragIds = new Set((question.dragItems ?? []).map((item) => item.id));
  const dragTexts = (question.dragItems ?? []).map((item) => normalize(item.text));

  pushCheck(
    checks,
    Boolean(question.questionText?.trim() || question.assets?.length),
    "has-content",
    question.questionText?.trim() ? "question text present" : "using image assets",
  );

  if (["single_choice", "multiple_choice", "yes_no", "case_study"].includes(question.type)) {
    pushCheck(checks, (question.options ?? []).length >= 2, "options-present", `option count ${(question.options ?? []).length}`);
    pushCheck(
      checks,
      new Set(optionTexts).size === optionTexts.length,
      "options-unique",
      `unique option texts ${new Set(optionTexts).size}/${optionTexts.length}`,
    );
    if (question.correctAnswer) {
      pushCheck(checks, optionIds.has(question.correctAnswer), "correct-answer-in-options", question.correctAnswer);
    }
    if (question.correctAnswers?.length) {
      pushCheck(
        checks,
        question.correctAnswers.every((answerId) => optionIds.has(answerId)),
        "correct-answers-in-options",
        question.correctAnswers.join(", "),
      );
    }
  }

  if (["dropdown", "hotspot"].includes(question.type)) {
    const expectedBoxes = getMaxExplanationBox(question);
    pushCheck(
      checks,
      (question.dropdowns ?? []).length > 0,
      "dropdowns-present",
      `dropdown count ${(question.dropdowns ?? []).length}`,
    );
    pushCheck(
      checks,
      !expectedBoxes || (question.dropdowns ?? []).length >= expectedBoxes,
      "dropdown-count-matches-explanation",
      `dropdown count ${(question.dropdowns ?? []).length}, explanation boxes ${expectedBoxes}`,
    );
    for (const dropdown of question.dropdowns ?? []) {
      const normalizedOptions = (dropdown.options ?? []).map((option) => normalize(option));
      pushCheck(
        checks,
        (dropdown.options ?? []).length >= 2,
        `${dropdown.id}-options-present`,
        `${dropdown.label}: ${(dropdown.options ?? []).length} options`,
      );
      pushCheck(
        checks,
        new Set(normalizedOptions).size === normalizedOptions.length,
        `${dropdown.id}-options-unique`,
        dropdown.label,
      );
      pushCheck(
        checks,
        normalizedOptions.includes(normalize(dropdown.correctAnswer)),
        `${dropdown.id}-correct-in-options`,
        `${dropdown.label}: ${dropdown.correctAnswer}`,
      );
    }
  }

  if (["drag_drop", "ordering", "select_place"].includes(question.type)) {
    pushCheck(
      checks,
      (question.dragItems ?? []).length > 0,
      "drag-items-present",
      `drag item count ${(question.dragItems ?? []).length}`,
    );
    pushCheck(
      checks,
      (question.dropZones ?? []).length > 0,
      "drop-zones-present",
      `drop zone count ${(question.dropZones ?? []).length}`,
    );
    pushCheck(
      checks,
      new Set(dragTexts).size === dragTexts.length,
      "drag-items-unique",
      `unique drag texts ${new Set(dragTexts).size}/${dragTexts.length}`,
    );
    for (const zone of question.dropZones ?? []) {
      pushCheck(
        checks,
        dragIds.has(zone.correctItemId),
        `${zone.id}-valid-correct-item`,
        `${zone.label}: ${zone.correctItemId}`,
      );
    }
  }

  pushCheck(
    checks,
    Boolean(question.explanation?.trim()),
    "has-explanation",
    question.explanation?.trim() ? "explanation present" : "missing explanation",
  );

  const failedChecks = checks.filter((check) => !check.ok);
  const status = failedChecks.length === 0 ? (question.manualReview ? "warning" : "pass") : "fail";

  return {
    id: question.id,
    type: question.type,
    title: question.title,
    manualReview: question.manualReview,
    manualReviewReasons: question.manualReviewReasons ?? [],
    status,
    failedChecks,
    checks,
  };
}

const perQuestion = questions.map(auditQuestion);
const summary = {
  totalQuestions: questions.length,
  passed: perQuestion.filter((item) => item.status === "pass").length,
  warnings: perQuestion.filter((item) => item.status === "warning").length,
  failed: perQuestion.filter((item) => item.status === "fail").length,
  failedQuestionIds: perQuestion.filter((item) => item.status === "fail").map((item) => item.id),
  warningQuestionIds: perQuestion.filter((item) => item.status === "warning").map((item) => item.id),
};

const payload = { summary, perQuestion };
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

console.log(`audited questions: ${summary.totalQuestions}`);
console.log(`passed: ${summary.passed}`);
console.log(`warnings: ${summary.warnings}`);
console.log(`failed: ${summary.failed}`);
if (summary.failedQuestionIds.length) {
  console.log(`failed question ids: ${summary.failedQuestionIds.join(", ")}`);
}
if (summary.warningQuestionIds.length) {
  console.log(`warning question ids: ${summary.warningQuestionIds.join(", ")}`);
}
