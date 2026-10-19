import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function unlinkCandidateTask({
  candidateId,
  taskId,
}: {
  candidateId: string;
  taskId: string;
}) {
  const response = await client.candidate[":id"].tasks[":taskId"].$delete({
    param: { id: candidateId, taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default unlinkCandidateTask;
