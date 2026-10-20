import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type PoolValueInput = string | string[] | null;

async function upsertPoolMember({
  poolId,
  contactId,
  values,
}: {
  poolId: string;
  contactId: string;
  values?: Record<string, PoolValueInput>;
}) {
  const response = await client.pool[":poolId"].members[":contactId"].$put({
    param: { poolId, contactId },
    json: { values },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default upsertPoolMember;
