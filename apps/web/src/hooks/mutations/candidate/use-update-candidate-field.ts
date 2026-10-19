import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCandidateField from "@/fetchers/candidate/update-candidate-field";

function useUpdateCandidateField(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCandidateField,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["candidate-fields", workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate"] });
    },
  });
}

export default useUpdateCandidateField;
