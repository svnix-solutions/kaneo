import { useMutation, useQueryClient } from "@tanstack/react-query";
import updatePool from "@/fetchers/pool/update-pool";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useUpdatePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePool,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUpdatePool;
