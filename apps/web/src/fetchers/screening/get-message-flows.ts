import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getMessageFlows(workspaceId: string) {
  const response = await client.screening.workspace[":workspaceId"].flows.$get({
    param: { workspaceId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getMessageFlows;
