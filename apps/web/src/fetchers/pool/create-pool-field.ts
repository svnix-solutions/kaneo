import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreatePoolFieldRequest = {
  poolId: string;
  name: string;
  type: "text" | "number" | "date" | "dropdown" | "boolean" | "multiselect";
  required?: boolean;
  defaultValue?: string;
  options?: string[];
};

async function createPoolField({ poolId, ...json }: CreatePoolFieldRequest) {
  const response = await client.pool[":poolId"].fields.$post({
    param: { poolId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createPoolField;
