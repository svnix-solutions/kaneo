import { useMutation, useQueryClient } from "@tanstack/react-query";
import createContact from "@/fetchers/contact/create-contact";
import { invalidateContactData } from "./invalidate-contact-data";

function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContact,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useCreateContact;
