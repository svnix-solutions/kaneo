import { useQuery } from "@tanstack/react-query";
import getPoolFields from "@/fetchers/pool/get-pool-fields";

function useGetPoolFields(poolId: string) {
  return useQuery({
    queryKey: ["pool-fields", poolId],
    queryFn: () => getPoolFields(poolId),
    enabled: !!poolId,
  });
}

export default useGetPoolFields;
