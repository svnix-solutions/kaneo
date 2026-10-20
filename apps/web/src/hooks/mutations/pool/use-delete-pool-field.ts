import { useMutation, useQueryClient } from "@tanstack/react-query";
import deletePoolField from "@/fetchers/pool/delete-pool-field";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useDeletePoolField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePoolField,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useDeletePoolField;
