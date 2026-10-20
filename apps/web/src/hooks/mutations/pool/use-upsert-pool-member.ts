import { useMutation, useQueryClient } from "@tanstack/react-query";
import upsertPoolMember from "@/fetchers/pool/upsert-pool-member";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useUpsertPoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertPoolMember,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useUpsertPoolMember;
