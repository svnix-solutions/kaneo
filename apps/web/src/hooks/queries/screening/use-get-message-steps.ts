import { useQuery } from "@tanstack/react-query";
import getMessageSteps from "@/fetchers/screening/get-message-steps";

function useGetMessageSteps(projectId: string) {
  return useQuery({
    queryKey: ["message-steps", projectId],
    queryFn: () => getMessageSteps(projectId),
    enabled: !!projectId,
  });
}

export default useGetMessageSteps;
