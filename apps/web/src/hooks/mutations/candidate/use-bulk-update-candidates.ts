import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkUpdateCandidates from "@/fetchers/candidate/bulk-update-candidates";
import { invalidateCandidate } from "./invalidate-candidate";

function useBulkUpdateCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateCandidates,
    onSuccess: (_data, { ids }) => {
      for (const id of ids) {
        void queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      }
      invalidateCandidate(queryClient);
    },
  });
}

export default useBulkUpdateCandidates;
