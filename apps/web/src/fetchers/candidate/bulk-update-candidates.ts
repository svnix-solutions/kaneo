import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CandidateValueInput } from "./set-candidate-values";

export type BulkUpdateCandidatesRequest = {
  workspaceId: string;
  ids: string[];
  source?: string | null;
  values?: Record<string, CandidateValueInput>;
};

async function bulkUpdateCandidates({
  workspaceId,
  ...json
}: BulkUpdateCandidatesRequest) {
  const response = await client.candidate.workspace[
    ":workspaceId"
  ].bulk.update.$post({ param: { workspaceId }, json });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkUpdateCandidates;
