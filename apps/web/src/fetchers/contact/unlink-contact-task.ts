import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function unlinkContactTask({
  contactId,
  taskId,
}: {
  contactId: string;
  taskId: string;
}) {
  const response = await client.contact[":id"].tasks[":taskId"].$delete({
    param: { id: contactId, taskId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default unlinkContactTask;
