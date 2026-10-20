import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkUpdatePoolMembers from "@/fetchers/pool/bulk-update-pool-members";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useBulkUpdatePoolMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdatePoolMembers,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useBulkUpdatePoolMembers;
