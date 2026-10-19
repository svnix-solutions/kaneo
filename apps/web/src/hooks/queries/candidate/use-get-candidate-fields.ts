import { useQuery } from "@tanstack/react-query";
import getCandidateFields from "@/fetchers/candidate/get-candidate-fields";

function useGetCandidateFields(workspaceId: string) {
  return useQuery({
    queryKey: ["candidate-fields", workspaceId],
    queryFn: () => getCandidateFields(workspaceId),
    enabled: !!workspaceId,
  });
}

export default useGetCandidateFields;
