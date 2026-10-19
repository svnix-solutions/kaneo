import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreateCandidateRequest = {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
};

async function createCandidate({
  workspaceId,
  ...json
}: CreateCandidateRequest) {
  const response = await client.candidate.workspace[":workspaceId"].$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createCandidate;
