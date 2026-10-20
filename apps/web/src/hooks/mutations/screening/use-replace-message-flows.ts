import { useMutation, useQueryClient } from "@tanstack/react-query";
import replaceMessageFlows from "@/fetchers/screening/replace-message-flows";

function useReplaceMessageFlows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceMessageFlows,
    onSuccess: (flows, { workspaceId }) =>
      queryClient.setQueryData(["message-flows", workspaceId], flows),
  });
}

export default useReplaceMessageFlows;
