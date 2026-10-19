import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function linkCandidateTask({
  candidateId,
  taskId,
}: {
  candidateId: string;
  taskId: string;
}) {
  const response = await client.candidate[":id"].tasks.$post({
    param: { id: candidateId },
    json: { taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default linkCandidateTask;
