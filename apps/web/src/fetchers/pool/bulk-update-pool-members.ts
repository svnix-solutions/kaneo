import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type { PoolValueInput } from "./upsert-pool-member";

async function bulkUpdatePoolMembers({
  poolId,
  ids,
  values,
}: {
  poolId: string;
  ids: string[];
  values: Record<string, PoolValueInput>;
}) {
  const response = await client.pool[":poolId"].bulk.update.$post({
    param: { poolId },
    json: { ids, values },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkUpdatePoolMembers;
