import { useQuery } from "@tanstack/react-query";
import getPools from "@/fetchers/pool/get-pools";

function useGetPools(workspaceId: string) {
  return useQuery({
    queryKey: ["pools", workspaceId],
    queryFn: () => getPools(workspaceId),
    enabled: !!workspaceId,
  });
}

export default useGetPools;
