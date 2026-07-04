# PL-300 Exam Simulator

Next.js + TypeScript exam simulator for Microsoft PL-300 practice, built from the provided PDF question bank.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- Python extraction pipeline with PyMuPDF + Pillow
- Local JSON data and localStorage persistence

## Features

- Practice mode
  - All questions, custom range, or incorrect questions only
  - Immediate answer checking
  - Explanation and answer reveal
  - Mark for review
- Exam mode
  - Random 60-question timed exam
  - 120-minute default timer
  - Percentage score
  - Correct answers count
  - Scaled score out of 1000
  - Pass/fail threshold at 700
- Full mock mode
  - All 301 questions
  - Save and resume through localStorage
- Review and browse
  - Marked questions
  - Incorrect questions
  - Filters by type, tag, image, explanation, and outcome
- PDF extraction
  - All 301 questions extracted
  - Structured JSON output
  - Generated image assets for exhibits and image-backed answer areas
  - Validation report with missing-answer, missing-explanation, and manual-review counts

## Project Structure

```text
app/
components/
data/
  questions.json
  validation-report.json
lib/
public/
  question-assets/
scripts/
  extract_pdf.py
  validate_questions.py
  manual_overrides.json
source-pdfs/
  pl-300.pdf
store/
```

## Requirements

- Node.js 22+ and npm
- Python 3.11+ with the `py` launcher on Windows

## Setup

```bash
npm install
npm run extract-pdf
npm run dev
```

Open `http://localhost:3000`.

## Extraction Workflow

`npm run extract-pdf` does all of the following:

1. Installs the Python extraction dependencies from `scripts/requirements.txt`
2. Parses `source-pdfs/pl-300.pdf`
3. Regenerates `data/questions.json`
4. Regenerates `public/question-assets/`
5. Runs validation and writes `data/validation-report.json`
6. Prints:
   - total questions extracted
   - questions missing answers
   - questions missing explanations
   - questions requiring manual review

Latest generated validation summary:

- Total questions extracted: `301`
- Questions missing answers: `0`
- Questions missing explanations: `0`
- Questions requiring manual review: `24`

The remaining manual-review items are mostly image-recovered hotspot/dropdown answers and case-study-heavy questions.

## Replace the PDF

Default source path:

```text
source-pdfs/pl-300.pdf
```

To replace it:

1. Put the new PDF in `source-pdfs/`
2. Rename it to `pl-300.pdf`, or pass a custom path:

```bash
npm run extract-pdf -- --pdf source-pdfs/my-new-exam.pdf
```

If the new file has a different question layout, adjust the parsing rules in `scripts/extract_pdf.py`.

## Manual Fixes

There are two supported ways to correct extracted questions:

### 1. Edit the final JSON directly

File:

```text
data/questions.json
```

After manual edits, rerun:

```bash
npm run validate-questions
```

### 2. Add durable extraction overrides

File:

```text
scripts/manual_overrides.json
```

Use this for image-only answers or special parsing cases you want reapplied every time extraction runs.

## Validation Rules

The validator checks:

- Total extracted questions equals `301`
- Every question has an `id`
- Every question has `questionText` or an asset
- Every question has a correct answer
- Every question has a `type`

Run it manually with:

```bash
npm run validate-questions
```

## Notes

- The generated data includes source images for many exhibit-heavy questions.
- Some hotspot and case-study items still carry a manual-review flag even when answer data is present. This is intentional and helps identify questions that rely heavily on visual context.
- Progress, exam history, marked questions, and saved sessions are stored in browser localStorage.
