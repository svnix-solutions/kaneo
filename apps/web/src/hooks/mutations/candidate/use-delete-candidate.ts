import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteCandidate from "@/fetchers/candidate/delete-candidate";

function useDeleteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCandidate,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["candidate", id] });
      queryClient.removeQueries({ queryKey: ["candidate-tasks", id] });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["task-candidates"] });
    },
  });
}

export default useDeleteCandidate;
