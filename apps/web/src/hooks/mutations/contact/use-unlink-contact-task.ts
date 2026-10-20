import { useMutation, useQueryClient } from "@tanstack/react-query";
import unlinkContactTask from "@/fetchers/contact/unlink-contact-task";
import { invalidateContactData } from "./invalidate-contact-data";

function useUnlinkContactTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkContactTask,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUnlinkContactTask;
