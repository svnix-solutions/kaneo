import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CandidateValueInput = string | string[] | null;

async function setCandidateValues({
  id,
  values,
}: {
  id: string;
  values: Record<string, CandidateValueInput>;
}) {
  const response = await client.candidate[":id"].values.$put({
    param: { id },
    json: { values },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setCandidateValues;
