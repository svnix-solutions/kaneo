import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type MessageFlowInput = {
  name: string;
  typebotPublicId: string;
  description?: string | null;
};

async function replaceMessageFlows({
  workspaceId,
  flows,
}: {
  workspaceId: string;
  flows: MessageFlowInput[];
}) {
  const response = await client.screening.workspace[":workspaceId"].flows.$put({
    param: { workspaceId },
    json: { flows },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default replaceMessageFlows;
