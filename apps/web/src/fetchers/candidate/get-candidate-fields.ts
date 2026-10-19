import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getCandidateFields(workspaceId: string) {
  const response = await client.candidate.workspace[":workspaceId"].fields.$get(
    { param: { workspaceId } },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getCandidateFields;
