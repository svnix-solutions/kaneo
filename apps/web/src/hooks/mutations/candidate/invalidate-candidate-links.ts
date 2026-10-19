import type { QueryClient } from "@tanstack/react-query";

export function invalidateCandidateLinks(
  queryClient: QueryClient,
  { candidateId, taskId }: { candidateId: string; taskId: string },
) {
  void queryClient.invalidateQueries({
    queryKey: ["candidate-tasks", candidateId],
  });
  void queryClient.invalidateQueries({ queryKey: ["task-candidates", taskId] });
}
