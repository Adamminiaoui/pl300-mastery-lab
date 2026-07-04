from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import fitz
from PIL import Image

from validate_questions import validate_questions


sys.stdout.reconfigure(encoding="utf-8")

EXPECTED_QUESTION_COUNT = 301
OPTION_RE = re.compile(r"^([A-H])[\.\)]\s*(.+)$")
BOX_RE = re.compile(r"^Box\s+(\d+):\s*(.+?)(?:\s*-\s*)?$", re.IGNORECASE)
NUMBERED_STEP_RE = re.compile(r"^\s*(\d+)[\.\)]\s+(.+)$")
QUESTION_RE = re.compile(r"Question:\s*(\d+)")
URL_RE = re.compile(r"https?://[^\s<>\"']+")
SECTION_RE = re.compile(
    r"^(Answer:|Explanation:|Reference:|Hot Area:|Select and Place:)$", re.IGNORECASE
)
TYPE_PREFIX_RE = re.compile(
    r"^(HOTSPOT|DRAG\s*DROP|Introductory Info Case Study)\s*-?\s*$", re.IGNORECASE
)
COMPLEX_KEYWORDS = (
    "exhibit",
    "graphic",
    "table",
    "hot area",
    "drop-down",
    "select and place",
    "drag",
    "case study",
)
TAG_RULES: dict[str, tuple[str, ...]] = {
    "Power Query": ("power query", "merge queries", "append queries", "query editor"),
    "Modeling": ("relationship", "star schema", "dimension", "fact table", "model"),
    "DAX": ("dax", "measure", "calculated column", "calculated table"),
    "Power BI Service": ("power bi service", "workspace", "publish", "app workspace"),
    "Security": ("row-level security", "rls", "security", "role"),
    "DirectQuery": ("directquery", "direct query"),
    "Import": ("import mode", "imported table", "import "),
    "Visualization": ("visual", "chart", "report", "dashboard"),
    "Dataflows": ("dataflow", "dataflows"),
    "Gateway": ("gateway", "on-premises data gateway"),
    "Refresh": ("refresh", "scheduled refresh", "incremental refresh"),
    "Service": ("powerbi.com", "service"),
}


@dataclass(frozen=True)
class Marker:
    question_id: int
    page_index: int
    y: float


@dataclass(frozen=True)
class TextBlock:
    page_index: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass(frozen=True)
class PageSegment:
    page_index: int
    start_y: float
    end_y: float


def normalize_text(value: str) -> str:
    cleaned = value.replace("\uf0d8", "•").replace("\u2711", "•")
    cleaned = cleaned.replace("\xa0", " ")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip().strip("|").strip()


def block_is_marker(text: str) -> bool:
    return bool(QUESTION_RE.search(text))


def block_is_noise(text: str) -> bool:
    cleaned = clean_line(text)
    return cleaned in {"CertyIQ", ""} or cleaned.startswith("Get certification quickly")


def load_sorted_blocks(page: fitz.Page) -> list[TextBlock]:
    blocks: list[TextBlock] = []
    for raw in page.get_text("blocks"):
        x0, y0, x1, y1, text, *_ = raw
        blocks.append(TextBlock(page.number, x0, y0, x1, y1, normalize_text(text)))
    return sorted(blocks, key=lambda item: (round(item.y0, 2), round(item.x0, 2)))


def collect_markers(doc: fitz.Document) -> list[Marker]:
    markers: list[Marker] = []
    for page_index in range(doc.page_count):
        for block in load_sorted_blocks(doc.load_page(page_index)):
            match = QUESTION_RE.search(block.text)
            if match:
                markers.append(
                    Marker(
                        question_id=int(match.group(1)),
                        page_index=page_index,
                        y=block.y0,
                    )
                )
    markers.sort(key=lambda item: item.question_id)
    return markers


def build_page_segments(
    doc: fitz.Document, current: Marker, next_marker: Marker | None
) -> list[PageSegment]:
    segments: list[PageSegment] = []
    last_page_index = next_marker.page_index if next_marker else doc.page_count - 1

    for page_index in range(current.page_index, last_page_index + 1):
        page = doc.load_page(page_index)
        start_y = current.y if page_index == current.page_index else 0.0
        if next_marker and page_index == next_marker.page_index:
            end_y = next_marker.y
        else:
            end_y = page.rect.height
        segments.append(PageSegment(page_index, max(start_y, 0.0), max(end_y, 0.0)))

    return segments


def collect_question_blocks(
    doc: fitz.Document, current: Marker, next_marker: Marker | None
) -> tuple[list[TextBlock], list[PageSegment]]:
    segments = build_page_segments(doc, current, next_marker)
    blocks: list[TextBlock] = []

    for segment in segments:
        page_blocks = load_sorted_blocks(doc.load_page(segment.page_index))
        for block in page_blocks:
            if block.y0 < segment.start_y:
                continue
            if block.y0 >= segment.end_y:
                continue
            if block_is_marker(block.text) or block_is_noise(block.text):
                continue
            blocks.append(block)

    return blocks, segments


def split_sections(raw_text: str) -> tuple[str, str, str]:
    answer_match = re.search(r"Answer:\s*(.*?)(?=\nExplanation:|\Z)", raw_text, re.IGNORECASE | re.DOTALL)
    explanation_match = re.search(r"Explanation:\s*(.*)\Z", raw_text, re.IGNORECASE | re.DOTALL)

    stem = raw_text
    answer_text = ""
    explanation = ""

    if answer_match:
        stem = raw_text[: answer_match.start()].strip()
        answer_text = normalize_text(answer_match.group(1))
    if explanation_match:
        if answer_match and explanation_match.start() < answer_match.end():
            explanation = normalize_text(explanation_match.group(1))
        else:
            explanation = normalize_text(explanation_match.group(1))
    elif answer_match:
        explanation = normalize_text(raw_text[answer_match.end() :])

    if answer_match and explanation_match:
        stem = raw_text[: answer_match.start()].strip()

    return normalize_text(stem), answer_text.strip(), explanation.strip()


def strip_type_prefix(text: str) -> tuple[str, str | None]:
    lines = [line for line in (clean_line(item) for item in text.splitlines()) if line]
    if not lines:
        return text, None

    first_line = lines[0]
    if TYPE_PREFIX_RE.match(first_line):
        return normalize_text("\n".join(lines[1:])), first_line

    normalized_first = first_line.replace(" ", "").replace("|", "")
    if normalized_first.upper() in {"HOTSPOT-", "DRAGDROP-", "DRAGDROP", "HOTSPOT"}:
        return normalize_text("\n".join(lines[1:])), first_line

    return normalize_text("\n".join(lines)), None


def extract_options(stem_text: str) -> tuple[str, list[dict[str, str]]]:
    lines = [line for line in (clean_line(item) for item in stem_text.splitlines()) if line]
    options: list[dict[str, str]] = []
    stem_lines: list[str] = []
    in_options = False

    for line in lines:
        if line in {"Hot Area:", "Select and Place:"}:
            stem_lines.append(line)
            continue

        option_match = OPTION_RE.match(line)
        if option_match:
            in_options = True
            options.append({"id": option_match.group(1), "text": option_match.group(2).strip()})
            continue

        if in_options and options and not SECTION_RE.match(line):
            options[-1]["text"] = f"{options[-1]['text']} {line}".strip()
            continue

        stem_lines.append(line)

    stem = normalize_text("\n".join(stem_lines))
    return stem, options


def extract_references(raw_text: str) -> tuple[list[str], str]:
    references: list[str] = []
    explanation = raw_text

    if "Reference:" in raw_text:
        explanation, reference_block = raw_text.split("Reference:", 1)
        references.extend(URL_RE.findall(reference_block))

    references.extend(URL_RE.findall(raw_text))
    unique_references = list(dict.fromkeys(reference.rstrip(".,)") for reference in references))
    return unique_references, normalize_text(explanation)


def parse_answer_letters(answer_text: str) -> list[str]:
    if not answer_text:
        return []

    compact = re.sub(r"[^A-Z]", "", answer_text.upper())
    if re.fullmatch(r"[A-H]+", compact):
        return list(compact)

    tokens = re.findall(r"\b([A-H])\b", answer_text.upper())
    return tokens


def infer_question_type(raw_text: str, options: list[dict[str, str]], answer_letters: list[str]) -> str:
    lower = raw_text.lower()
    opening = raw_text[:120].lower()

    if "introductory info case study" in opening or "case study" in opening:
        return "case_study"
    if "drag drop" in opening or "drag drop" in lower:
        if "select and place" in lower:
            return "select_place"
        if "in sequence" in lower or "correct order" in lower or "arrange them in the correct order" in lower:
            return "ordering"
        return "drag_drop"
    if "hotspot" in opening or "hot area" in lower:
        if "drop-down" in lower or "drop down" in lower or "select the answer choice that completes each statement" in lower:
            return "dropdown"
        return "hotspot"
    if options and all(option["text"].strip().lower() in {"yes", "no"} for option in options):
        return "yes_no"
    if len(answer_letters) > 1:
        return "multiple_choice"
    if options:
        multiple_hints = (
            "each correct selection is worth one point",
            "each correct answer presents a complete solution",
            "which two",
            "which three",
            "which four",
        )
        if any(hint in lower for hint in multiple_hints):
            return "multiple_choice"
        return "single_choice"
    return "single_choice"


def parse_box_answers(explanation: str) -> list[dict[str, str]]:
    box_answers: list[dict[str, str]] = []
    for raw_line in explanation.splitlines():
        line = clean_line(raw_line)
        match = BOX_RE.match(line)
        if not match:
            continue
        answer_text = match.group(2).strip()
        if answer_text.endswith("-"):
            answer_text = answer_text[:-1].strip()
        box_answers.append(
            {
                "id": f"box-{match.group(1)}",
                "label": f"Box {match.group(1)}",
                "correctAnswer": answer_text,
            }
        )
    return box_answers


def parse_ordered_steps(explanation: str) -> list[str]:
    lines = [clean_line(line) for line in explanation.splitlines()]
    lines = [line for line in lines if line and line.lower() not in {"reference:", "note:"}]

    numbered_steps: list[tuple[int, str]] = []
    for line in lines:
        match = NUMBERED_STEP_RE.match(line)
        if match:
            numbered_steps.append((int(match.group(1)), match.group(2).strip()))
    if numbered_steps:
        return [step for _, step in sorted(numbered_steps, key=lambda item: item[0])]

    collected: list[str] = []
    for line in lines:
        if line.lower().startswith(("reference:", "note:", "incorrect:", "correct:", "box ")):
            break
        if URL_RE.search(line):
            break
        collected.append(line)
        if len(collected) >= 6:
            break

    if len(collected) >= 2:
        return collected
    return []


def parse_compact_answer_lines(explanation: str) -> list[str]:
    lines = [clean_line(line) for line in explanation.splitlines()]
    lines = [line for line in lines if line]

    numbered_steps: list[tuple[int, str]] = []
    for line in lines:
        match = NUMBERED_STEP_RE.match(line)
        if match:
            numbered_steps.append((int(match.group(1)), match.group(2).strip().rstrip(";")))
    if numbered_steps:
        return [step for _, step in sorted(numbered_steps, key=lambda item: item[0])]

    compact: list[str] = []
    for line in lines:
        lower = line.lower()
        if lower.startswith(("reference:", "note:", "incorrect:", "correct:")):
            break
        if URL_RE.search(line):
            break
        if len(line) > 90 and any(token in lower for token in (" because ", " therefore ", " solution ", " requirement ")):
            break
        compact.append(line.rstrip(";"))
        if len(compact) >= 5:
            break

    if len(compact) >= 2:
        return compact
    return []


def infer_tags(text: str) -> list[str]:
    lower = text.lower()
    tags = [tag for tag, hints in TAG_RULES.items() if any(hint in lower for hint in hints)]
    if not tags:
        tags = ["Power BI"]
    return tags


def requires_assets(question_type: str, raw_text: str, segments: list[PageSegment]) -> bool:
    lower = raw_text.lower()
    if question_type in {"dropdown", "hotspot", "drag_drop", "ordering", "select_place", "case_study"}:
        return True
    if len(segments) > 1:
        return True
    return any(keyword in lower for keyword in COMPLEX_KEYWORDS)


def save_segments_as_assets(
    doc: fitz.Document,
    question_id: int,
    segments: list[PageSegment],
    output_dir: Path,
) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    assets: list[str] = []

    for index, segment in enumerate(segments, start=1):
        page = doc.load_page(segment.page_index)
        clip = fitz.Rect(
            0,
            max(segment.start_y - 6, 0),
            page.rect.width,
            min(segment.end_y + 6, page.rect.height),
        )
        if clip.height < 18:
            continue

        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), clip=clip, alpha=False)
        image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
        path = output_dir / f"q{question_id:03d}-p{index}.webp"
        image.save(path, "WEBP", quality=84, method=6)
        assets.append(f"/question-assets/{path.name}")

    return assets


def build_drag_structure(correct_steps: Iterable[str]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    drag_items: list[dict[str, str]] = []
    drop_zones: list[dict[str, str]] = []

    for index, step in enumerate(correct_steps, start=1):
        item_id = f"item-{index}"
        drag_items.append({"id": item_id, "text": step})
        drop_zones.append({"id": f"zone-{index}", "label": f"Step {index}", "correctItemId": item_id})

    return drag_items, drop_zones


def build_box_drag_structure(box_answers: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    drag_items: list[dict[str, str]] = []
    drop_zones: list[dict[str, str]] = []

    for index, answer in enumerate(box_answers, start=1):
        item_id = f"item-{index}"
        drag_items.append({"id": item_id, "text": answer["correctAnswer"]})
        drop_zones.append(
            {
                "id": f"zone-{index}",
                "label": answer["label"],
                "correctItemId": item_id,
            }
        )

    return drag_items, drop_zones


def strip_prompt_artifacts(stem: str) -> str:
    cleaned = normalize_text(stem.replace("Hot Area:", "").replace("Select and Place:", ""))
    cleaned = re.sub(r"\s+Question\s*$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def build_generic_dropdowns(items: Iterable[str]) -> list[dict[str, Any]]:
    return [
        {"id": f"box-{index}", "label": f"Box {index}", "options": [], "correctAnswer": item}
        for index, item in enumerate(items, start=1)
    ]


def load_manual_overrides(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def apply_manual_override(question: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    for key, value in override.items():
        question[key] = value

    question["hasImage"] = bool(question.get("assets"))
    question["multipleCorrect"] = bool(question.get("correctAnswers")) or question.get("type") == "multiple_choice"
    if question.get("dropdowns"):
        question["answerFormat"] = "dropdown"
    elif question.get("dropZones"):
        question["answerFormat"] = "drag"
    elif question.get("correctAnswers"):
        question["answerFormat"] = "multi"
    else:
        question["answerFormat"] = "single"
    if "manualReview" not in override:
        question["manualReview"] = bool(question.get("manualReviewReasons"))
    return question


def build_question(
    doc: fitz.Document,
    current: Marker,
    next_marker: Marker | None,
    asset_dir: Path,
) -> dict[str, Any]:
    blocks, segments = collect_question_blocks(doc, current, next_marker)
    raw_text = normalize_text("\n\n".join(block.text for block in blocks if block.text))
    stem_section, answer_text, explanation_text = split_sections(raw_text)
    stem_without_type, type_prefix = strip_type_prefix(stem_section)
    stem_text, options = extract_options(stem_without_type)
    references, explanation = extract_references(explanation_text)

    answer_letters = parse_answer_letters(answer_text)
    question_type = infer_question_type(
        type_prefix + "\n" + raw_text if type_prefix else raw_text,
        options,
        answer_letters,
    )
    box_answers = parse_box_answers(explanation)
    ordered_steps = parse_ordered_steps(explanation) if question_type in {"ordering", "drag_drop", "select_place"} else []

    dropdowns: list[dict[str, Any]] = []
    drag_items: list[dict[str, str]] = []
    drop_zones: list[dict[str, str]] = []
    correct_answer: str | None = None
    correct_answers: list[str] = []
    answer_format = "single"

    if question_type in {"dropdown", "hotspot"} and box_answers:
        dropdowns = [
            {
                "id": answer["id"],
                "label": answer["label"],
                "options": [],
                "correctAnswer": answer["correctAnswer"],
            }
            for answer in box_answers
        ]
        answer_format = "dropdown"
    elif question_type in {"drag_drop", "select_place"} and box_answers:
        drag_items, drop_zones = build_box_drag_structure(box_answers)
        answer_format = "drag"
    elif question_type == "ordering" and ordered_steps:
        drag_items, drop_zones = build_drag_structure(ordered_steps)
        answer_format = "drag"
    elif question_type in {"drag_drop", "select_place"} and ordered_steps:
        drag_items, drop_zones = build_drag_structure(ordered_steps)
        answer_format = "drag"
    elif question_type in {"dropdown", "hotspot"}:
        compact_answers = parse_compact_answer_lines(explanation)
        if compact_answers:
            dropdowns = build_generic_dropdowns(compact_answers)
            answer_format = "dropdown"
    elif len(answer_letters) > 1:
        correct_answers = answer_letters
        answer_format = "multi"
    elif answer_letters:
        correct_answer = answer_letters[0]
    elif answer_text:
        correct_answer = answer_text

    if question_type == "yes_no" and not correct_answer and answer_letters:
        correct_answer = answer_letters[0]

    prompt = strip_prompt_artifacts(stem_text)
    source_pages = [segment.page_index + 1 for segment in segments]
    assets: list[str] = []
    if requires_assets(question_type, raw_text, segments):
        assets = save_segments_as_assets(doc, current.question_id, segments, asset_dir)

    manual_review_reasons: list[str] = []
    if not prompt and not assets:
        manual_review_reasons.append("missing-question-text")
    if question_type in {"single_choice", "multiple_choice", "yes_no", "case_study"} and not options:
        manual_review_reasons.append("missing-options")
    if question_type in {"dropdown", "hotspot"} and not dropdowns:
        manual_review_reasons.append("needs-visual-answer-area")
    if question_type in {"drag_drop", "ordering", "select_place"} and not drop_zones:
        manual_review_reasons.append("needs-manual-drag-structure")
    if not explanation:
        manual_review_reasons.append("missing-explanation")
    if not any((correct_answer, correct_answers, dropdowns, drop_zones)):
        manual_review_reasons.append("missing-correct-answer")
    if "exhibit" in raw_text.lower() and not assets:
        manual_review_reasons.append("missing-exhibit-asset")

    return {
        "id": current.question_id,
        "sourcePage": source_pages[0],
        "sourceEndPage": source_pages[-1],
        "type": question_type,
        "title": f"Question {current.question_id}",
        "prompt": prompt,
        "questionText": prompt,
        "rawText": raw_text,
        "options": options,
        "correctAnswer": correct_answer,
        "correctAnswers": correct_answers,
        "dropdowns": dropdowns,
        "dragItems": drag_items,
        "dropZones": drop_zones,
        "explanation": explanation,
        "references": references,
        "assets": assets,
        "tags": infer_tags(raw_text),
        "difficulty": "unknown",
        "multipleCorrect": len(correct_answers) > 1 or question_type == "multiple_choice",
        "hasImage": bool(assets),
        "manualReview": bool(manual_review_reasons),
        "manualReviewReasons": manual_review_reasons,
        "answerFormat": answer_format,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def extract_questions(pdf_path: Path, output_json: Path, asset_dir: Path) -> dict[str, Any]:
    if asset_dir.exists():
        shutil.rmtree(asset_dir)
    asset_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    markers = collect_markers(doc)
    overrides = load_manual_overrides(Path(__file__).with_name("manual_overrides.json"))
    if len(markers) != EXPECTED_QUESTION_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_QUESTION_COUNT} question markers but found {len(markers)}."
        )

    questions = []
    for index, marker in enumerate(markers):
        next_marker = markers[index + 1] if index + 1 < len(markers) else None
        question = build_question(doc, marker, next_marker, asset_dir)
        override = overrides.get(str(marker.question_id))
        if override:
            question = apply_manual_override(question, override)
        questions.append(question)

    write_json(output_json, questions)
    report = validate_questions(questions)
    write_json(output_json.parent / "validation-report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract PL-300 exam practice questions from a PDF.")
    parser.add_argument(
        "--pdf",
        type=Path,
        default=Path("source-pdfs/pl-300.pdf"),
        help="Path to the source PDF exam file.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/questions.json"),
        help="Path for the generated questions JSON file.",
    )
    parser.add_argument(
        "--assets",
        type=Path,
        default=Path("public/question-assets"),
        help="Directory for generated question image assets.",
    )
    args = parser.parse_args()

    report = extract_questions(args.pdf, args.output, args.assets)

    print(f"total questions extracted: {report['totalQuestions']}")
    print(f"questions missing answers: {len(report['missingAnswers'])}")
    print(f"questions missing explanations: {len(report['missingExplanations'])}")
    print(f"questions requiring manual review: {len(report['manualReview'])}")

    if not report["countMatchesExpected"]:
        print(
            f"warning: expected {report['expectedCount']} questions but found {report['totalQuestions']}"
        )
    if report["missingAnswers"]:
        print(f"warning: missing answer question ids: {report['missingAnswers'][:25]}")
    if report["missingExplanations"]:
        print(
            f"warning: missing explanation question ids: {report['missingExplanations'][:25]}"
        )
    if report["manualReview"]:
        print(f"warning: manual review question ids: {report['manualReview'][:25]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
