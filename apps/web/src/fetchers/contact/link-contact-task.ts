import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function linkContactTask({
  contactId,
  taskId,
}: {
  contactId: string;
  taskId: string;
}) {
  const response = await client.contact[":id"].tasks.$post({
    param: { id: contactId },
    json: { taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default linkContactTask;
