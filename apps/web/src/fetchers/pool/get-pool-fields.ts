import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getPoolFields(poolId: string) {
  const response = await client.pool[":poolId"].fields.$get({
    param: { poolId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getPoolFields;
