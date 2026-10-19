import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getCandidates({
  workspaceId,
  q,
  limit,
  offset,
}: {
  workspaceId: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const response = await client.candidate.workspace[":workspaceId"].$get({
    param: { workspaceId },
    query: {
      q: q?.trim() || undefined,
      limit: limit?.toString(),
      offset: offset?.toString(),
    },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getCandidates;
