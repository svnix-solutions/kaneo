import { useMutation, useQueryClient } from "@tanstack/react-query";
import replaceMessageSteps from "@/fetchers/screening/replace-message-steps";

function useReplaceMessageSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceMessageSteps,
    onSuccess: (steps, { projectId }) =>
      queryClient.setQueryData(["message-steps", projectId], steps),
  });
}

export default useReplaceMessageSteps;
