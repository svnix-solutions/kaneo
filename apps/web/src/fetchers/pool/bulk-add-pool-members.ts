import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function bulkAddPoolMembers({
  poolId,
  ids,
}: {
  poolId: string;
  ids: string[];
}) {
  const response = await client.pool[":poolId"].bulk.add.$post({
    param: { poolId },
    json: { ids },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkAddPoolMembers;
