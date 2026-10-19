import { keepPreviousData, useQuery } from "@tanstack/react-query";
import getCandidates from "@/fetchers/candidate/get-candidates";

// The API caps a page at 200; the candidates page shows one page and the total.
export const CANDIDATE_PAGE_SIZE = 200;

function useGetCandidates(workspaceId: string, q = "") {
  return useQuery({
    queryKey: ["candidates", workspaceId, q],
    queryFn: () =>
      getCandidates({ workspaceId, q, limit: CANDIDATE_PAGE_SIZE }),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export default useGetCandidates;
