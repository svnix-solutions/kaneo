import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkAddPoolMembers from "@/fetchers/pool/bulk-add-pool-members";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useBulkAddPoolMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkAddPoolMembers,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useBulkAddPoolMembers;
