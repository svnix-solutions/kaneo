import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getContactTasks(id: string) {
  const response = await client.contact[":id"].tasks.$get({ param: { id } });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getContactTasks;
