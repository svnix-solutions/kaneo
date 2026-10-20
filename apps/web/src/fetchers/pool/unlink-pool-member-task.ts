import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function unlinkPoolMemberTask({
  poolId,
  contactId,
  taskId,
}: {
  poolId: string;
  contactId: string;
  taskId: string;
}) {
  const response = await client.pool[":poolId"].members[":contactId"].tasks[
    ":taskId"
  ].$delete({
    param: { poolId, contactId, taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default unlinkPoolMemberTask;
