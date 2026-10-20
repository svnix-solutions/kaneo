import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type { InferRequestType } from "hono/client";

type QueryRequest = InferRequestType<
  (typeof client)["contact"]["workspace"][":workspaceId"]["query"]["$post"]
>["json"];

export type ContactFilterRequest = NonNullable<QueryRequest["filter"]>;
export type ContactFilterCondition = ContactFilterRequest["conditions"][number];

async function queryContacts({
  workspaceId,
  q,
  filter,
  limit,
  offset,
}: {
  workspaceId: string;
  q?: string;
  filter?: ContactFilterRequest;
  limit?: number;
  offset?: number;
}) {
  const response = await client.contact.workspace[":workspaceId"].query.$post({
    param: { workspaceId },
    json: {
      q: q?.trim() || undefined,
      filter: filter?.conditions.length ? filter : undefined,
      limit,
      offset,
    },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default queryContacts;
