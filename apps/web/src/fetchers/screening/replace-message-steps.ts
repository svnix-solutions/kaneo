import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type MessageStepInput = {
  name: string;
  typebotPublicId: string;
  offsetDays: number;
  enabled?: boolean;
};

async function replaceMessageSteps({
  projectId,
  steps,
}: {
  projectId: string;
  steps: MessageStepInput[];
}) {
  const response = await client.screening.project[":projectId"].steps.$put({
    param: { projectId },
    json: { steps },
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default replaceMessageSteps;
