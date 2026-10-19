import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function bulkDeleteCandidates({
  workspaceId,
  ids,
}: {
  workspaceId: string;
  ids: string[];
}) {
  const response = await client.candidate.workspace[
    ":workspaceId"
  ].bulk.delete.$post({ param: { workspaceId }, json: { ids } });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkDeleteCandidates;
