import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteContact from "@/fetchers/contact/delete-contact";
import { invalidateContactData } from "./invalidate-contact-data";

function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteContact,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useDeleteContact;
