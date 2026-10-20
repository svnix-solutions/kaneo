import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function setContactTargets({
  id,
  poolIds,
}: {
  id: string;
  poolIds: string[];
}) {
  const response = await client.contact[":id"].targets.$put({
    param: { id },
    json: { poolIds },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setContactTargets;
