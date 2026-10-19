import type { QueryClient } from "@tanstack/react-query";

/** Refresh one candidate and every cached candidate list. */
export function invalidateCandidate(queryClient: QueryClient, id?: string) {
  if (id) {
    void queryClient.invalidateQueries({ queryKey: ["candidate", id] });
  }
  void queryClient.invalidateQueries({ queryKey: ["candidates"] });
  // Linked-candidate lists on task pages show the same name and phone.
  void queryClient.invalidateQueries({ queryKey: ["task-candidates"] });
}
