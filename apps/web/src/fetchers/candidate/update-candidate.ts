import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdateCandidateRequest = {
  id: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
};

async function updateCandidate({ id, ...json }: UpdateCandidateRequest) {
  const response = await client.candidate[":id"].$put({
    param: { id },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateCandidate;
