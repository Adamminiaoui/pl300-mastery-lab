import type { Question, QuestionResponse } from "@/lib/types";

import { DropdownQuestion } from "@/components/questions/dropdown-question";

interface HotspotQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function HotspotQuestion(props: HotspotQuestionProps) {
  return <DropdownQuestion {...props} />;
}
