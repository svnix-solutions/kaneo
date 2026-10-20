import { useMutation, useQueryClient } from "@tanstack/react-query";
import unlinkPoolMemberTask from "@/fetchers/pool/unlink-pool-member-task";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useUnlinkPoolMemberTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkPoolMemberTask,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUnlinkPoolMemberTask;
