import { useQuery } from "@tanstack/react-query";
import getTaskPoolMembers from "@/fetchers/pool/get-task-pool-members";

function useGetTaskPoolMembers(taskId: string) {
  return useQuery({
    queryKey: ["task-pool-members", taskId],
    queryFn: () => getTaskPoolMembers(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskPoolMembers;
