import { useQuery } from "@tanstack/react-query";
import getCandidateTasks from "@/fetchers/candidate/get-candidate-tasks";

function useGetCandidateTasks(id: string) {
  return useQuery({
    queryKey: ["candidate-tasks", id],
    queryFn: () => getCandidateTasks(id),
    enabled: !!id,
  });
}

export default useGetCandidateTasks;
