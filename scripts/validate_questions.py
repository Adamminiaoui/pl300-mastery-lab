from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


EXPECTED_QUESTION_COUNT = 301


def _has_answer(question: dict[str, Any]) -> bool:
    if question.get("correctAnswer"):
        return True
    if question.get("correctAnswers"):
        return bool(question["correctAnswers"])
    if question.get("dropdowns"):
        return all(item.get("correctAnswer") for item in question["dropdowns"])
    if question.get("dropZones"):
        return all(item.get("correctItemId") for item in question["dropZones"])
    return False


def _has_prompt(question: dict[str, Any]) -> bool:
    return bool((question.get("questionText") or "").strip() or question.get("assets"))


def validate_questions(questions: list[dict[str, Any]]) -> dict[str, Any]:
    missing_ids: list[int] = []
    missing_type: list[int] = []
    missing_prompt: list[int] = []
    missing_answer: list[int] = []
    missing_explanation: list[int] = []
    manual_review: list[int] = []

    for question in questions:
        question_id = question.get("id", -1)
        if not question.get("id"):
            missing_ids.append(question_id)
        if not question.get("type"):
            missing_type.append(question_id)
        if not _has_prompt(question):
            missing_prompt.append(question_id)
        if not _has_answer(question):
            missing_answer.append(question_id)
        if not (question.get("explanation") or "").strip():
            missing_explanation.append(question_id)
        if question.get("manualReview"):
            manual_review.append(question_id)

    return {
        "expectedCount": EXPECTED_QUESTION_COUNT,
        "totalQuestions": len(questions),
        "countMatchesExpected": len(questions) == EXPECTED_QUESTION_COUNT,
        "missingIds": missing_ids,
        "missingTypes": missing_type,
        "missingPromptOrAssets": missing_prompt,
        "missingAnswers": missing_answer,
        "missingExplanations": missing_explanation,
        "manualReview": manual_review,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate extracted PL-300 questions JSON.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/questions.json"),
        help="Path to the extracted questions JSON file.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("data/validation-report.json"),
        help="Path to write the validation report JSON.",
    )
    args = parser.parse_args()

    questions = json.loads(args.input.read_text(encoding="utf-8"))
    report = validate_questions(questions)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"total questions extracted: {report['totalQuestions']}")
    print(f"questions missing answers: {len(report['missingAnswers'])}")
    print(f"questions missing explanations: {len(report['missingExplanations'])}")
    print(f"questions requiring manual review: {len(report['manualReview'])}")

    if not report["countMatchesExpected"]:
        print(
            f"warning: expected {report['expectedCount']} questions but found {report['totalQuestions']}"
        )
    if report["missingIds"]:
        print(f"warning: questions missing ids: {report['missingIds'][:25]}")
    if report["missingTypes"]:
        print(f"warning: questions missing types: {report['missingTypes'][:25]}")
    if report["missingPromptOrAssets"]:
        print(
            "warning: questions missing question text or assets: "
            f"{report['missingPromptOrAssets'][:25]}"
        )
    if report["missingAnswers"]:
        print(f"warning: questions missing answers: {report['missingAnswers'][:25]}")
    if report["missingExplanations"]:
        print(
            "warning: questions missing explanations: "
            f"{report['missingExplanations'][:25]}"
        )
    if report["manualReview"]:
        print(f"warning: manual review questions: {report['manualReview'][:25]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
