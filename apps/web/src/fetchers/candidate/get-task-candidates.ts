import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getTaskCandidates(taskId: string) {
  const response = await client.candidate.task[":taskId"].$get({
    param: { taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getTaskCandidates;
