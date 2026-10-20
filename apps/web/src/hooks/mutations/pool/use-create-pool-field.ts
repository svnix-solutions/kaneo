import { useMutation, useQueryClient } from "@tanstack/react-query";
import createPoolField from "@/fetchers/pool/create-pool-field";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useCreatePoolField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPoolField,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useCreatePoolField;
