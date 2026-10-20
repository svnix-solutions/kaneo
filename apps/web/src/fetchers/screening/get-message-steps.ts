import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getMessageSteps(projectId: string) {
  const response = await client.screening.project[":projectId"].steps.$get({
    param: { projectId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getMessageSteps;
