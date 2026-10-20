import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function bulkUpdateContacts({
  workspaceId,
  ids,
  source,
}: {
  workspaceId: string;
  ids: string[];
  source: string | null;
}) {
  const response = await client.contact.workspace[
    ":workspaceId"
  ].bulk.update.$post({
    param: { workspaceId },
    json: { ids, source },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkUpdateContacts;
