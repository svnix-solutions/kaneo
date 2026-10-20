import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getPool(poolId: string) {
  const response = await client.pool[":poolId"].$get({ param: { poolId } });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getPool;
