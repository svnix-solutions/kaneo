import { useQuery } from "@tanstack/react-query";
import getMessageFlows from "@/fetchers/screening/get-message-flows";

function useGetMessageFlows(workspaceId: string) {
  return useQuery({
    queryKey: ["message-flows", workspaceId],
    queryFn: () => getMessageFlows(workspaceId),
    enabled: !!workspaceId,
  });
}

export default useGetMessageFlows;
