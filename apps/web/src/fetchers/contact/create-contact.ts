import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreateContactRequest = {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
};

async function createContact({ workspaceId, ...json }: CreateContactRequest) {
  const response = await client.contact.workspace[":workspaceId"].$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createContact;
