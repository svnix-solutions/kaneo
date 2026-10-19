import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdateCandidateFieldRequest = {
  fieldId: string;
  name?: string;
  required?: boolean;
  defaultValue?: string | null;
  options?: string[];
  position?: number;
};

async function updateCandidateField({
  fieldId,
  ...json
}: UpdateCandidateFieldRequest) {
  const response = await client.candidate.fields[":fieldId"].$put({
    param: { fieldId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateCandidateField;
