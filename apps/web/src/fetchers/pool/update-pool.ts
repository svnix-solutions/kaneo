import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdatePoolRequest = {
  poolId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  screeningProjectId?: string | null;
  position?: number;
};

async function updatePool({ poolId, ...json }: UpdatePoolRequest) {
  const response = await client.pool[":poolId"].$put({
    param: { poolId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updatePool;
