import { useQuery } from "@tanstack/react-query";
import getPool from "@/fetchers/pool/get-pool";

function useGetPool(poolId: string) {
  return useQuery({
    queryKey: ["pool", poolId],
    queryFn: () => getPool(poolId),
    enabled: !!poolId,
  });
}

export default useGetPool;
