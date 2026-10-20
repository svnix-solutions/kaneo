import { useMutation, useQueryClient } from "@tanstack/react-query";
import createPool from "@/fetchers/pool/create-pool";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useCreatePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPool,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useCreatePool;
