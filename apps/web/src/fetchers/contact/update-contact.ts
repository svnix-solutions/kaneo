import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdateContactRequest = {
  id: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
};

async function updateContact({ id, ...json }: UpdateContactRequest) {
  const response = await client.contact[":id"].$put({ param: { id }, json });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateContact;
