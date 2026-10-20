import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deletePoolField(fieldId: string) {
  const response = await client.pool.fields[":fieldId"].$delete({
    param: { fieldId },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deletePoolField;
