import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type QueryRequest = InferRequestType<
  (typeof client)["candidate"]["workspace"][":workspaceId"]["query"]["$post"]
>["json"];

export type CandidateFilterRequest = NonNullable<QueryRequest["filter"]>;
export type CandidateFilterCondition =
  CandidateFilterRequest["conditions"][number];

async function queryCandidates({
  workspaceId,
  q,
  filter,
  limit,
  offset,
}: {
  workspaceId: string;
  q?: string;
  filter?: CandidateFilterRequest;
  limit?: number;
  offset?: number;
}) {
  const response = await client.candidate.workspace[":workspaceId"].query.$post(
    {
      param: { workspaceId },
      json: {
        q: q?.trim() || undefined,
        filter: filter?.conditions.length ? filter : undefined,
        limit,
        offset,
      },
    },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default queryCandidates;
