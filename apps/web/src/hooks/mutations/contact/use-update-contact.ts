import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateContact from "@/fetchers/contact/update-contact";
import { invalidateContactData } from "./invalidate-contact-data";

function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateContact,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUpdateContact;
