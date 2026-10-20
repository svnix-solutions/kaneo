import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getContact(id: string) {
  const response = await client.contact[":id"].$get({ param: { id } });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getContact;
