import { useMutation, useQueryClient } from "@tanstack/react-query";
import addPoolMembersToBoard from "@/fetchers/pool/add-pool-members-to-board";
import { invalidateContactData } from "../contact/invalidate-contact-data";

function useAddPoolMembersToBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addPoolMembersToBoard,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useAddPoolMembersToBoard;
