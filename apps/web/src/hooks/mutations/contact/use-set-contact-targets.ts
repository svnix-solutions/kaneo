import { useMutation, useQueryClient } from "@tanstack/react-query";
import setContactTargets from "@/fetchers/contact/set-contact-targets";
import { invalidateContactData } from "./invalidate-contact-data";

function useSetContactTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setContactTargets,
    onSuccess: () => invalidateContactData(queryClient),
  });
}

export default useSetContactTargets;
