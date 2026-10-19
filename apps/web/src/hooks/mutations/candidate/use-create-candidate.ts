import { useMutation, useQueryClient } from "@tanstack/react-query";
import createCandidate from "@/fetchers/candidate/create-candidate";
import { invalidateCandidate } from "./invalidate-candidate";

function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCandidate,
    onSuccess: () => invalidateCandidate(queryClient),
  });
}

export default useCreateCandidate;
