import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function addPoolMembersToBoard({
  poolId,
  ...json
}: {
  poolId: string;
  ids: string[];
  projectId: string;
  columnId?: string;
}) {
  const response = await client.pool[":poolId"].bulk["add-to-board"].$post({
    param: { poolId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default addPoolMembersToBoard;
