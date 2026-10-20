import { useQuery } from "@tanstack/react-query";
import getPoolMemberTasks from "@/fetchers/pool/get-pool-member-tasks";

function useGetPoolMemberTasks(poolId: string, contactId: string) {
  return useQuery({
    queryKey: ["pool-member-tasks", poolId, contactId],
    queryFn: () => getPoolMemberTasks({ poolId, contactId }),
    enabled: !!poolId && !!contactId,
  });
}

export default useGetPoolMemberTasks;
