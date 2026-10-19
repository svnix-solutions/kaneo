import { useQuery } from "@tanstack/react-query";
import getCandidate from "@/fetchers/candidate/get-candidate";

function useGetCandidate(id: string) {
  return useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate(id),
    enabled: !!id,
  });
}

export default useGetCandidate;
