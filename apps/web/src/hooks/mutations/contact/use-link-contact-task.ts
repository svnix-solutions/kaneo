import { useMutation, useQueryClient } from "@tanstack/react-query";
import linkContactTask from "@/fetchers/contact/link-contact-task";
import { invalidateContactData } from "./invalidate-contact-data";

function useLinkContactTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkContactTask,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useLinkContactTask;
