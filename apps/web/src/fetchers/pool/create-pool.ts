import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreatePoolRequest = {
  workspaceId: string;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
};

async function createPool({ workspaceId, ...json }: CreatePoolRequest) {
  const response = await client.pool.workspace[":workspaceId"].$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createPool;
