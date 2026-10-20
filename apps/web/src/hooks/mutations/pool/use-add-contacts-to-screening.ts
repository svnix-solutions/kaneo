import { useMutation, useQueryClient } from "@tanstack/react-query";
import addContactsToScreening from "@/fetchers/pool/add-contacts-to-screening";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useAddContactsToScreening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addContactsToScreening,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useAddContactsToScreening;
