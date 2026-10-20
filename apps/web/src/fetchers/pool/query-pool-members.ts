import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type { ContactFilterRequest } from "@/fetchers/contact/query-contacts";

async function queryPoolMembers({
  poolId,
  q,
  filter,
  limit,
  offset,
}: {
  poolId: string;
  q?: string;
  filter?: ContactFilterRequest;
  limit?: number;
  offset?: number;
}) {
  const response = await client.pool[":poolId"].query.$post({
    param: { poolId },
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

export default queryPoolMembers;
