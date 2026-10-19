import { useMutation, useQueryClient } from "@tanstack/react-query";
import linkCandidateTask from "@/fetchers/candidate/link-candidate-task";
import { invalidateCandidateLinks } from "./invalidate-candidate-links";

function useLinkCandidateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkCandidateTask,
    onSuccess: (_data, variables) =>
      invalidateCandidateLinks(queryClient, variables),
  });
}

export default useLinkCandidateTask;
