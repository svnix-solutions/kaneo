import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getPools(workspaceId: string) {
  const response = await client.pool.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getPools;
