import { useMutation, useQueryClient } from "@tanstack/react-query";
import setCandidateValues from "@/fetchers/candidate/set-candidate-values";
import { invalidateCandidate } from "./invalidate-candidate";

function useSetCandidateValues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCandidateValues,
    onSuccess: (_data, variables) =>
      invalidateCandidate(queryClient, variables.id),
  });
}

export default useSetCandidateValues;
