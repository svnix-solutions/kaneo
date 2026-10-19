import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteCandidateField from "@/fetchers/candidate/delete-candidate-field";

function useDeleteCandidateField(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCandidateField,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["candidate-fields", workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate"] });
    },
  });
}

export default useDeleteCandidateField;
