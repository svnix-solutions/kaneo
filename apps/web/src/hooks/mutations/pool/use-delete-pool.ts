import { useMutation, useQueryClient } from "@tanstack/react-query";
import deletePool from "@/fetchers/pool/delete-pool";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useDeletePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePool,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useDeletePool;
