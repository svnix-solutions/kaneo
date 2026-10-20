import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkUpdateContacts from "@/fetchers/contact/bulk-update-contacts";
import { invalidateContactData } from "./invalidate-contact-data";

function useBulkUpdateContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateContacts,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useBulkUpdateContacts;
