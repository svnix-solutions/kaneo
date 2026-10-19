import { useQuery } from "@tanstack/react-query";
import getTaskCandidates from "@/fetchers/candidate/get-task-candidates";

function useGetTaskCandidates(taskId: string) {
  return useQuery({
    queryKey: ["task-candidates", taskId],
    queryFn: () => getTaskCandidates(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskCandidates;
