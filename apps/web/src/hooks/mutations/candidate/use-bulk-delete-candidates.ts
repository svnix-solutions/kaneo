import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkDeleteCandidates from "@/fetchers/candidate/bulk-delete-candidates";

function useBulkDeleteCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkDeleteCandidates,
    onSuccess: (_data, { ids }) => {
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: ["candidate", id] });
        queryClient.removeQueries({ queryKey: ["candidate-tasks", id] });
      }
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["task-candidates"] });
    },
  });
}

export default useBulkDeleteCandidates;
