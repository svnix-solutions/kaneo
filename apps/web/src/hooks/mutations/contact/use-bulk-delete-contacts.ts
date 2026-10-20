import { useMutation, useQueryClient } from "@tanstack/react-query";
import bulkDeleteContacts from "@/fetchers/contact/bulk-delete-contacts";
import { invalidateContactData } from "./invalidate-contact-data";

function useBulkDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkDeleteContacts,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useBulkDeleteContacts;
