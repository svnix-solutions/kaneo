import { useQuery } from "@tanstack/react-query";
import getContactTasks from "@/fetchers/contact/get-contact-tasks";

function useGetContactTasks(id: string) {
  return useQuery({
    queryKey: ["contact-tasks", id],
    queryFn: () => getContactTasks(id),
    enabled: !!id,
  });
}

export default useGetContactTasks;
