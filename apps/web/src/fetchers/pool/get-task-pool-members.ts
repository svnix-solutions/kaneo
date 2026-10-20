import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getTaskPoolMembers(taskId: string) {
  const response = await client.pool.task[":taskId"].members.$get({
    param: { taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getTaskPoolMembers;
