import { useQuery } from "@tanstack/react-query";
import getTaskContacts from "@/fetchers/contact/get-task-contacts";

function useGetTaskContacts(taskId: string) {
  return useQuery({
    queryKey: ["task-contacts", taskId],
    queryFn: () => getTaskContacts(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskContacts;
