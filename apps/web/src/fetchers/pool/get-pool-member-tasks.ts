import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getPoolMemberTasks({
  poolId,
  contactId,
}: {
  poolId: string;
  contactId: string;
}) {
  const response = await client.pool[":poolId"].members[
    ":contactId"
  ].tasks.$get({
    param: { poolId, contactId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getPoolMemberTasks;
