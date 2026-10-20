import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function bulkRemovePoolMembers({
  poolId,
  ids,
}: {
  poolId: string;
  ids: string[];
}) {
  const response = await client.pool[":poolId"].bulk.remove.$post({
    param: { poolId },
    json: { ids },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkRemovePoolMembers;
