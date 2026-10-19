import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCandidate from "@/fetchers/candidate/update-candidate";
import { invalidateCandidate } from "./invalidate-candidate";

function useUpdateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCandidate,
    onSuccess: (candidate) => {
      queryClient.setQueryData(["candidate", candidate.id], candidate);
      invalidateCandidate(queryClient, candidate.id);
    },
  });
}

export default useUpdateCandidate;
