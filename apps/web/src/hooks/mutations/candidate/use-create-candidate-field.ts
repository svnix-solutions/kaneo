import { useMutation, useQueryClient } from "@tanstack/react-query";
import createCandidateField from "@/fetchers/candidate/create-candidate-field";

function useCreateCandidateField(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCandidateField,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["candidate-fields", workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate"] });
    },
  });
}

export default useCreateCandidateField;
