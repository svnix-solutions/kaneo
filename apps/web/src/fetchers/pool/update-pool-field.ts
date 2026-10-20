import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdatePoolFieldRequest = {
  fieldId: string;
  name?: string;
  required?: boolean;
  defaultValue?: string | null;
  options?: string[];
  position?: number;
};

async function updatePoolField({ fieldId, ...json }: UpdatePoolFieldRequest) {
  const response = await client.pool.fields[":fieldId"].$put({
    param: { fieldId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updatePoolField;
