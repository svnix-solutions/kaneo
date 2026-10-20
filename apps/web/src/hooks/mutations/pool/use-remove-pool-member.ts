import { useMutation, useQueryClient } from "@tanstack/react-query";
import removePoolMember from "@/fetchers/pool/remove-pool-member";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useRemovePoolMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removePoolMember,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useRemovePoolMember;
