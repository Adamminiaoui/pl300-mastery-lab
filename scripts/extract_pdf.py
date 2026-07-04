from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import sys
from difflib import SequenceMatcher
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import cv2
import fitz
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

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


@dataclass(frozen=True)
class OcrLine:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    score: float


OCR_ENGINE: RapidOCR | None = None
OCR_CACHE: dict[str, list[OcrLine]] = {}
NO_SPACE_FIXES = {
    "oneminute": "one minute",
    "storagemode": "Storage mode",
    "answerarea": "Answer Area",
    "tablefilterdaxexpression": "Table Filter DAX Expression",
    "daxfunction": "DAX Function",
}
LEFT_CHOICE_HEADINGS = {
    "actions",
    "tasks",
    "values",
    "dax function",
    "table filter dax expression",
    "storage modes",
    "join kinds",
    "roles",
    "visuals",
    "ai insights services",
}
PLACEHOLDER_VALUES = {"storage mode", "value"}
NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
}


def normalize_text(value: str) -> str:
    cleaned = value.replace("\uf0d8", "•").replace("\u2711", "•")
    cleaned = cleaned.replace("\xa0", " ")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip().strip("|").strip()


def normalize_key(text: str) -> str:
    key = text.lower()
    key = re.sub(r"[^a-z0-9]+", " ", key)
    return re.sub(r"\s+", " ", key).strip()


def normalize_compact_key(text: str) -> str:
    return normalize_key(text).replace(" ", "")


def normalize_match_text(text: str) -> str:
    normalized = normalize_key(text)
    replacements = {
        "single": "one",
        "1st": "first",
        "2nd": "second",
        "3rd": "third",
        "4th": "fourth",
    }
    words = [replacements.get(word, word) for word in normalized.split()]
    return " ".join(words)


def prettify_ocr_text(text: str) -> str:
    value = clean_line(text)
    compact = normalize_compact_key(value)
    if compact in NO_SPACE_FIXES:
        return NO_SPACE_FIXES[compact]

    value = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", value)
    value = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", value)
    value = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", value)
    value = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", value)
    value = value.replace(",", ", ")
    value = re.sub(r"\s{2,}", " ", value)

    replacements = (
        (r"\bAdda\b", "Add a"),
        (r"\bAddadatasource\b", "Add a data source"),
        (r"\bChangethe\b", "Change the"),
        (r"\bGroupthe\b", "Group the"),
        (r"\bBookmarkbutton\b", "Bookmark button"),
        (r"\bBookmarkproperty\b", "Bookmark property"),
        (r"\bAttributescolumn\b", "Attributes column"),
        (r"\bContentcolumn\b", "Content column"),
        (r"\bDatasourcetype\b", "Data source type"),
        (r"\bHumanResources\b", "Human Resources"),
        (r"\bIsfeaturedtable\b", "Is featured table"),
        (r"\bLiveConnect\b", "Live Connect"),
        (r"\bNavigatorwill\b", "Navigator will"),
        (r"\bPowerBl\b", "Power BI"),
        (r"\bandthenselect\b", "and then select"),
        (r"\bcombinethe\b", "combine the"),
        (r"\bremovethe\b", "remove the"),
        (r"\bascheduled\b", "a scheduled"),
        (r"\banon-premises\b", "an on-premises"),
        (r"userprincipalname O\b", "userprincipalname()"),
        (r"\bFalseo\b", "False()"),
        (r"\bTrueo\b", "True()"),
    )
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value, flags=re.IGNORECASE)

    compact = normalize_compact_key(value)
    if compact in NO_SPACE_FIXES:
        return NO_SPACE_FIXES[compact]
    return value.strip()


def get_ocr_engine() -> RapidOCR:
    global OCR_ENGINE
    if OCR_ENGINE is None:
        OCR_ENGINE = RapidOCR()
    return OCR_ENGINE


def merge_ocr_lines(lines: list[OcrLine], threshold: float = 18.0) -> list[OcrLine]:
    if not lines:
        return []

    sorted_lines = sorted(lines, key=lambda item: (round(item.y0, 1), round(item.x0, 1)))
    groups: list[list[OcrLine]] = []

    for line in sorted_lines:
        mid_y = (line.y0 + line.y1) / 2
        if not groups:
            groups.append([line])
            continue

        previous = groups[-1]
        previous_mid = sum((item.y0 + item.y1) / 2 for item in previous) / len(previous)
        if abs(mid_y - previous_mid) <= threshold:
            previous.append(line)
        else:
            groups.append([line])

    merged: list[OcrLine] = []
    for group in groups:
        ordered = sorted(group, key=lambda item: item.x0)
        merged.append(
            OcrLine(
                text=prettify_ocr_text(" ".join(item.text for item in ordered)),
                x0=min(item.x0 for item in ordered),
                y0=min(item.y0 for item in ordered),
                x1=max(item.x1 for item in ordered),
                y1=max(item.y1 for item in ordered),
                score=sum(item.score for item in ordered) / len(ordered),
            )
        )

    return [line for line in merged if line.text]


def run_ocr(image_or_path: Any) -> list[OcrLine]:
    result, _ = get_ocr_engine()(image_or_path)
    if not result:
        return []

    lines: list[OcrLine] = []
    for box, text, score in result:
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        cleaned = prettify_ocr_text(text)
        if not cleaned:
            continue
        lines.append(
            OcrLine(
                text=cleaned,
                x0=min(xs),
                y0=min(ys),
                x1=max(xs),
                y1=max(ys),
                score=float(score),
            )
        )

    return lines


def get_asset_ocr_lines(asset_path: Path) -> list[OcrLine]:
    cache_key = str(asset_path.resolve())
    cached = OCR_CACHE.get(cache_key)
    if cached is not None:
        return cached

    lines = sorted(run_ocr(str(asset_path)), key=lambda item: (round(item.y0, 1), round(item.x0, 1)))
    OCR_CACHE[cache_key] = lines
    return lines


def find_heading(lines: list[OcrLine], candidates: set[str]) -> OcrLine | None:
    for line in lines:
        if normalize_key(line.text) in candidates:
            return line
    return None


def find_answer_area_heading(lines: list[OcrLine]) -> OcrLine | None:
    for line in lines:
        compact = normalize_compact_key(line.text)
        if compact == "answerarea":
            return line
    return None


def detect_rectangles(
    image: Any,
    *,
    min_x: float = 0,
    max_x: float | None = None,
    min_y: float = 0,
    max_y: float | None = None,
    min_width: int = 100,
    min_height: int = 60,
    max_height: int | None = None,
) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresholded = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresholded, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape

    candidates: list[tuple[int, int, int, int, int]] = []
    for contour in contours:
        x, y, rect_width, rect_height = cv2.boundingRect(contour)
        area = rect_width * rect_height
        if x < min_x or y < min_y:
            continue
        if max_x is not None and x + rect_width > max_x:
            continue
        if max_y is not None and y + rect_height > max_y:
            continue
        if rect_width < min_width or rect_height < min_height:
            continue
        if max_height is not None and rect_height > max_height:
            continue
        if area > width * height * 0.55:
            continue
        candidates.append((x, y, rect_width, rect_height, area))

    candidates.sort(key=lambda item: item[4], reverse=True)
    kept: list[tuple[int, int, int, int, int]] = []
    for candidate in candidates:
        x, y, rect_width, rect_height, _ = candidate
        duplicate = False
        for existing_x, existing_y, existing_width, existing_height, _ in kept:
            same_rect = (
                abs(x - existing_x) <= 4
                and abs(y - existing_y) <= 4
                and abs(rect_width - existing_width) <= 8
                and abs(rect_height - existing_height) <= 8
            )
            inside_existing = (
                x >= existing_x - 5
                and y >= existing_y - 5
                and x + rect_width <= existing_x + existing_width + 5
                and y + rect_height <= existing_y + existing_height + 5
            )
            if same_rect or inside_existing:
                duplicate = True
                break
        if not duplicate:
            kept.append(candidate)

    return [(x, y, rect_width, rect_height) for x, y, rect_width, rect_height, _ in sorted(kept, key=lambda item: (item[1], item[0]))]


def extract_choice_lines_from_rect(
    image: Any,
    rect: tuple[int, int, int, int],
    full_lines: list[OcrLine],
) -> list[str]:
    x, y, width, height = rect
    crop = image[y : y + height, x : x + width]
    scaled = cv2.resize(crop, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    lines = merge_ocr_lines(run_ocr(scaled))
    if not lines:
        return []

    values: list[str] = []
    for line in lines:
        text = line.text
        if normalize_compact_key(text) == "answerarea":
            continue
        if normalize_key(text) in LEFT_CHOICE_HEADINGS:
            continue

        best = text
        compact = normalize_compact_key(text)
        for full_line in full_lines:
            if normalize_compact_key(full_line.text) == compact and full_line.text.count(" ") > best.count(" "):
                best = full_line.text
                break

        values.append(best)

    deduped = list(dict.fromkeys(prettify_ocr_text(value) for value in values if value))
    return [value for value in deduped if value]


def extract_text_from_rect(
    image: Any,
    rect: tuple[int, int, int, int],
) -> str:
    x, y, width, height = rect
    crop = image[y : y + height, x : x + width]
    scaled = cv2.resize(crop, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    lines = merge_ocr_lines(run_ocr(scaled), threshold=22.0)
    if not lines:
        return ""
    return normalize_text(" ".join(line.text for line in lines))


def score_text_match(candidate: str, evidence: str) -> float:
    normalized_candidate = normalize_match_text(candidate)
    normalized_evidence = normalize_match_text(evidence)
    if not normalized_candidate or not normalized_evidence:
        return 0.0
    if normalized_candidate in normalized_evidence:
        return 100.0 + len(normalized_candidate)

    candidate_tokens = set(normalized_candidate.split())
    evidence_tokens = set(normalized_evidence.split())
    overlap = len(candidate_tokens & evidence_tokens)
    sequence = SequenceMatcher(None, normalized_candidate, normalized_evidence).ratio()
    return overlap * 24.0 + sequence * 20.0


def select_best_option(options: list[str], evidence_sources: Iterable[str]) -> str | None:
    best_option: str | None = None
    best_score = 0.0
    evidences = [source for source in evidence_sources if source]

    for option in options:
        for evidence in evidences:
            score = score_text_match(option, evidence)
            if score > best_score:
                best_score = score
                best_option = option

    return best_option if best_score >= 18 else None


def split_explanation_paragraphs(explanation: str) -> list[str]:
    paragraphs = [normalize_text(block) for block in re.split(r"\n\s*\n", explanation) if normalize_text(block)]
    filtered: list[str] = []
    for paragraph in paragraphs:
        lower = paragraph.lower()
        if lower.startswith(("reference:", "note:")):
            continue
        if URL_RE.search(paragraph) and len(paragraph.split()) <= 8:
            continue
        filtered.append(paragraph)
    return filtered


def parse_labeled_answer_hints(explanation: str) -> list[tuple[str, str]]:
    hints: list[tuple[str, str]] = []
    label_pattern = re.compile(r"^([A-Za-z][A-Za-z0-9 '\[\]\-/]+?):\s*(.+)$")

    for raw_line in explanation.splitlines():
        line = clean_line(raw_line)
        if not line:
            continue

        box_match = BOX_RE.match(line)
        if box_match:
            hints.append((f"Box {box_match.group(1)}", box_match.group(2).strip().rstrip("-").strip()))
            continue

        label_match = label_pattern.match(line)
        if not label_match:
            continue

        label = label_match.group(1).strip()
        answer = label_match.group(2).strip().rstrip("-").strip()
        if answer and not URL_RE.search(answer):
            hints.append((label, answer))

    return hints


def extract_answer_for_label(explanation: str, label: str) -> str:
    escaped_label = re.escape(label)
    match = re.search(rf"([^.;\n]+?)\s+for\s+{escaped_label}\b", explanation, re.IGNORECASE)
    if match:
        return normalize_text(match.group(1))
    return ""


def infer_drag_zone_count(prompt: str, explanation: str, drop_zones: list[dict[str, str]]) -> int:
    ordered_steps = parse_ordered_steps(explanation)
    if ordered_steps:
        return len(ordered_steps)

    prompt_match = re.search(r"\bwhich\s+(one|two|three|four|five|six)\b", prompt.lower())
    if prompt_match:
        return NUMBER_WORDS[prompt_match.group(1)]

    return len(drop_zones)


def recover_dropdown_groups_from_asset(asset_path: Path) -> list[dict[str, Any]]:
    image = cv2.imread(str(asset_path))
    if image is None:
        return []

    full_lines = get_asset_ocr_lines(asset_path)
    answer_heading = find_answer_area_heading(full_lines)
    min_y = answer_heading.y1 + 8 if answer_heading else 0
    rectangles = detect_rectangles(image, min_y=min_y, min_width=110, min_height=80)

    groups: list[dict[str, Any]] = []
    for rect in rectangles:
        options = extract_choice_lines_from_rect(image, rect, full_lines)
        if len(options) < 2:
            continue

        x, y, _, height = rect
        label_candidates = [
            line
            for line in full_lines
            if line.x1 < x - 12 and line.y0 <= y + min(height * 0.38, 90) and line.y1 >= y - 24
        ]
        label = ""
        if label_candidates:
            label = normalize_text(" ".join(line.text for line in sorted(label_candidates, key=lambda item: (item.y0, item.x0))))
            label = label.rstrip(":").strip()

        groups.append({"label": label, "options": options})

    return groups


def recover_dropdown_groups(assets: list[str], asset_dir: Path) -> list[dict[str, Any]]:
    best: list[dict[str, Any]] = []
    for asset in assets:
        path = asset_dir / Path(asset).name
        groups = recover_dropdown_groups_from_asset(path)
        if len(groups) > len(best):
            best = groups
    return best


def recover_yes_no_options(dropdowns: list[dict[str, Any]], prompt: str, explanation: str) -> list[dict[str, Any]]:
    normalized_prompt = prompt.lower()
    normalized_explanation = explanation.lower()
    all_yes_no = dropdowns and all(
        normalize_key(item.get("correctAnswer", "")) in {"yes", "no"} for item in dropdowns
    )
    if not all_yes_no and "select yes if" not in normalized_prompt and "select yes if" not in normalized_explanation:
        return dropdowns

    updated: list[dict[str, Any]] = []
    for item in dropdowns:
        clone = dict(item)
        clone["options"] = ["Yes", "No"]
        current_correct = clone.get("correctAnswer", "")
        correct = next(
            (
                option
                for option in clone["options"]
                if normalize_compact_key(option) == normalize_compact_key(current_correct)
            ),
            None,
        )
        if not correct:
            correct = select_best_option(clone["options"], [current_correct, explanation])
        if correct:
            clone["correctAnswer"] = correct
        updated.append(clone)
    return updated


def recover_dropdowns(
    dropdowns: list[dict[str, Any]],
    assets: list[str],
    asset_dir: Path,
    prompt: str,
    explanation: str,
) -> list[dict[str, Any]]:
    groups = recover_dropdown_groups(assets, asset_dir)
    labeled_hints = parse_labeled_answer_hints(explanation)
    paragraphs = split_explanation_paragraphs(explanation)

    if not groups:
        return recover_yes_no_options(dropdowns, prompt, explanation)

    normalized_prompt = prompt.lower()
    normalized_explanation = explanation.lower()
    if (
        len(dropdowns) > len(groups)
        and (
            "select yes if" in normalized_prompt
            or "select yes if" in normalized_explanation
            or all(normalize_key(item.get("correctAnswer", "")) in {"yes", "no"} for item in dropdowns)
        )
    ):
        return recover_yes_no_options(dropdowns, prompt, explanation)

    rebuilt: list[dict[str, Any]] = []
    for index, group in enumerate(groups, start=1):
        current = dropdowns[index - 1] if index - 1 < len(dropdowns) else {}
        label = current.get("label") or group["label"] or f"Box {index}"
        if re.fullmatch(r"Box\s+\d+", label, flags=re.IGNORECASE) and group["label"]:
            label = group["label"]

        evidence_sources = [current.get("correctAnswer", ""), explanation]
        if index - 1 < len(paragraphs):
            evidence_sources.append(paragraphs[index - 1])
        for hint_label, hint_value in labeled_hints:
            if score_text_match(label, hint_label) >= 18:
                evidence_sources.append(hint_value)

        current_correct = current.get("correctAnswer", "")
        correct = next(
            (
                option
                for option in group["options"]
                if normalize_compact_key(option) == normalize_compact_key(current_correct)
            ),
            None,
        )
        if not correct:
            correct = select_best_option(group["options"], evidence_sources)
        if not correct and current.get("correctAnswer"):
            correct = current["correctAnswer"]

        rebuilt.append(
            {
                "id": current.get("id", f"box-{index}"),
                "label": label,
                "options": list(dict.fromkeys(group["options"])),
                "correctAnswer": correct or "",
            }
        )

    return recover_yes_no_options(rebuilt, prompt, explanation)


def extract_drag_choices_from_asset(asset_path: Path) -> list[str]:
    lines = get_asset_ocr_lines(asset_path)
    answer_heading = find_answer_area_heading(lines)
    left_heading = find_heading(lines, LEFT_CHOICE_HEADINGS)

    if not answer_heading or not left_heading:
        return []

    image = cv2.imread(str(asset_path))
    if image is not None:
        rectangles = detect_rectangles(
            image,
            max_x=answer_heading.x0 - 12,
            min_y=left_heading.y1 + 4,
            min_width=110,
            min_height=22,
            max_height=120,
        )
        boxed_choices = [
            extract_text_from_rect(image, rect)
            for rect in rectangles
        ]
        boxed_choices = [choice for choice in boxed_choices if choice]
        if len(boxed_choices) >= 2:
            return list(dict.fromkeys(prettify_ocr_text(choice) for choice in boxed_choices))

    choices: list[str] = []
    for line in lines:
        if line.y0 <= left_heading.y1 + 6:
            continue
        if line.x1 >= answer_heading.x0 - 18:
            continue
        if normalize_key(line.text) in LEFT_CHOICE_HEADINGS:
            continue
        choices.append(line.text)

    deduped = list(dict.fromkeys(choice for choice in choices if choice))
    return deduped


def extract_drag_targets_from_asset(asset_path: Path) -> list[dict[str, str]]:
    lines = get_asset_ocr_lines(asset_path)
    answer_heading = find_answer_area_heading(lines)
    if not answer_heading:
        return []

    right_side = [
        line
        for line in lines
        if line.x0 >= answer_heading.x0 - 10 and line.y0 > answer_heading.y1 + 8
    ]
    merged = merge_ocr_lines(right_side, threshold=22.0)
    targets: list[dict[str, str]] = []

    for line in merged:
        if ":" not in line.text:
            continue
        label, _, remainder = line.text.partition(":")
        clean_label = label.strip()
        clean_value = remainder.strip()
        targets.append(
            {
                "label": clean_label,
                "inlineAnswer": "" if normalize_key(clean_value) in PLACEHOLDER_VALUES else clean_value,
            }
        )

    return targets


def match_choice_text(choice_texts: list[str], evidence_sources: Iterable[str]) -> str | None:
    return select_best_option(choice_texts, evidence_sources)


def recover_drag_structure(
    drag_items: list[dict[str, str]],
    drop_zones: list[dict[str, str]],
    assets: list[str],
    asset_dir: Path,
    prompt: str,
    explanation: str,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    detected_choices: list[str] = []
    detected_targets: list[dict[str, str]] = []

    for asset in assets:
        path = asset_dir / Path(asset).name
        choices = extract_drag_choices_from_asset(path)
        if len(choices) > len(detected_choices):
            detected_choices = choices

        targets = extract_drag_targets_from_asset(path)
        if len(targets) > len(detected_targets):
            detected_targets = targets

    if not detected_choices:
        return drag_items, drop_zones

    normalized_choice_texts = list(dict.fromkeys(prettify_ocr_text(choice) for choice in detected_choices if choice))
    rebuilt_items = [
        {"id": f"item-{index}", "text": choice}
        for index, choice in enumerate(normalized_choice_texts, start=1)
    ]

    existing_choice_map = {item["id"]: item["text"] for item in drag_items}
    labeled_hints = parse_labeled_answer_hints(explanation)
    hint_map = {normalize_key(label): answer for label, answer in labeled_hints}
    paragraphs = split_explanation_paragraphs(explanation)
    ordered_hints = parse_ordered_steps(explanation)
    inferred_zone_count = infer_drag_zone_count(prompt, explanation, drop_zones)

    if detected_targets:
        target_labels = detected_targets
    elif drop_zones and inferred_zone_count <= len(drop_zones):
        target_labels = [
            {"label": zone.get("label", f"Step {index}"), "inlineAnswer": ""}
            for index, zone in enumerate(drop_zones, start=1)
        ]
    else:
        target_labels = [
            {"label": f"Step {index}", "inlineAnswer": ""}
            for index in range(1, inferred_zone_count + 1)
        ]

    rebuilt_zones: list[dict[str, str]] = []
    for index, target in enumerate(target_labels, start=1):
        label = target.get("label") or f"Step {index}"
        inline_answer = target.get("inlineAnswer", "")
        evidence_sources = [inline_answer, explanation, extract_answer_for_label(explanation, label)]

        normalized_label = normalize_key(label)
        for hint_label, hint_value in labeled_hints:
            if score_text_match(label, hint_label) >= 18:
                evidence_sources.append(hint_value)
        if normalized_label in hint_map:
            evidence_sources.append(hint_map[normalized_label])

        if index - 1 < len(drop_zones):
            existing_zone = drop_zones[index - 1]
            existing_text = existing_choice_map.get(existing_zone.get("correctItemId", ""), "")
            evidence_sources.append(existing_text)
        if index - 1 < len(paragraphs):
            evidence_sources.append(paragraphs[index - 1])
        if index - 1 < len(ordered_hints):
            evidence_sources.append(ordered_hints[index - 1])

        matched_choice = None
        for exact_source in [inline_answer, hint_map.get(normalized_label, ""), existing_choice_map.get(drop_zones[index - 1]["correctItemId"], "") if index - 1 < len(drop_zones) else "", extract_answer_for_label(explanation, label)]:
            matched_choice = next(
                (
                    option
                    for option in normalized_choice_texts
                    if normalize_compact_key(option) == normalize_compact_key(exact_source)
                ),
                None,
            )
            if matched_choice:
                break

        if not matched_choice:
            matched_choice = match_choice_text(normalized_choice_texts, evidence_sources)
        if not matched_choice and index - 1 < len(paragraphs):
            matched_choice = match_choice_text(normalized_choice_texts, [paragraphs[index - 1]])
        if not matched_choice and index - 1 < len(ordered_hints):
            matched_choice = match_choice_text(normalized_choice_texts, [ordered_hints[index - 1]])

        if not matched_choice and existing_choice_map:
            matched_choice = match_choice_text(normalized_choice_texts, existing_choice_map.values())

        if not matched_choice:
            continue

        matched_item = next(item for item in rebuilt_items if item["text"] == matched_choice)
        rebuilt_zones.append(
            {
                "id": f"zone-{index}",
                "label": label,
                "correctItemId": matched_item["id"],
            }
        )

    return rebuilt_items, rebuilt_zones or drop_zones

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


def find_solution_boundary(blocks: list[TextBlock]) -> TextBlock | None:
    for block in blocks:
        lines = [clean_line(line) for line in block.text.splitlines()]
        if any(
            line.startswith("Answer:") or line.startswith("Explanation:")
            for line in lines
            if line
        ):
            return block
    return None


def build_prompt_segments(
    segments: list[PageSegment],
    boundary: TextBlock | None,
) -> list[PageSegment]:
    if boundary is None:
        return segments

    prompt_segments: list[PageSegment] = []
    for segment in segments:
        if segment.page_index > boundary.page_index:
            break

        end_y = segment.end_y
        if segment.page_index == boundary.page_index:
            end_y = min(end_y, boundary.y0)

        if end_y - segment.start_y < 18:
            continue

        prompt_segments.append(
            PageSegment(
                page_index=segment.page_index,
                start_y=segment.start_y,
                end_y=end_y,
            )
        )

    return prompt_segments


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
            min(segment.end_y, page.rect.height),
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
    prompt_segments = build_prompt_segments(segments, find_solution_boundary(blocks))
    if requires_assets(question_type, raw_text, prompt_segments):
        assets = save_segments_as_assets(doc, current.question_id, prompt_segments, asset_dir)

    if question_type in {"dropdown", "hotspot"} and dropdowns and assets:
        dropdowns = recover_dropdowns(dropdowns, assets, asset_dir, prompt, explanation)
        answer_format = "dropdown"

    if question_type in {"drag_drop", "ordering", "select_place"} and assets:
        drag_items, drop_zones = recover_drag_structure(
            drag_items,
            drop_zones,
            assets,
            asset_dir,
            prompt,
            explanation,
        )
        if drop_zones:
            answer_format = "drag"

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
