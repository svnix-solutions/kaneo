import { keepPreviousData, useQuery } from "@tanstack/react-query";
import queryCandidates, {
  type CandidateFilterRequest,
} from "@/fetchers/candidate/query-candidates";
import { CANDIDATE_PAGE_SIZE } from "./use-get-candidates";

// Same cache prefix as useGetCandidates, so candidate mutations refresh it.
function useQueryCandidates(
  workspaceId: string,
  q: string,
  filter: CandidateFilterRequest,
) {
  return useQuery({
    queryKey: ["candidates", workspaceId, q, filter],
    queryFn: () =>
      queryCandidates({ workspaceId, q, filter, limit: CANDIDATE_PAGE_SIZE }),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export default useQueryCandidates;
