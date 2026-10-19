import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreateCandidateFieldRequest = {
  workspaceId: string;
  name: string;
  type: "text" | "number" | "date" | "dropdown" | "boolean" | "multiselect";
  required?: boolean;
  defaultValue?: string;
  options?: string[];
};

async function createCandidateField({
  workspaceId,
  ...json
}: CreateCandidateFieldRequest) {
  const response = await client.candidate.workspace[
    ":workspaceId"
  ].fields.$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createCandidateField;
