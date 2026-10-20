import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type BulkUpdateContactsRequest = {
  workspaceId: string;
  ids: string[];
  source?: string | null;
  priority?: ContactPriority;
  addTargetPoolIds?: string[];
  removeTargetPoolIds?: string[];
};

export type ContactPriority =
  | "no-priority"
  | "low"
  | "medium"
  | "high"
  | "urgent";

async function bulkUpdateContacts({
  workspaceId,
  ...json
}: BulkUpdateContactsRequest) {
  const response = await client.contact.workspace[
    ":workspaceId"
  ].bulk.update.$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkUpdateContacts;
