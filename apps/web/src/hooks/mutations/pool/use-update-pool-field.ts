import { useMutation, useQueryClient } from "@tanstack/react-query";
import updatePoolField from "@/fetchers/pool/update-pool-field";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useUpdatePoolField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePoolField,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUpdatePoolField;
