import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkRemovePoolMembers from "@/fetchers/pool/bulk-remove-pool-members";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useBulkRemovePoolMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkRemovePoolMembers,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useBulkRemovePoolMembers;
