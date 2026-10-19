import { useMutation, useQueryClient } from "@tanstack/react-query";
import unlinkCandidateTask from "@/fetchers/candidate/unlink-candidate-task";
import { invalidateCandidateLinks } from "./invalidate-candidate-links";

function useUnlinkCandidateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkCandidateTask,
    onSuccess: (_data, variables) =>
      invalidateCandidateLinks(queryClient, variables),
  });
}

export default useUnlinkCandidateTask;
