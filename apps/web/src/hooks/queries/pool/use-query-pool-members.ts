import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ContactFilterRequest } from "@/fetchers/contact/query-contacts";
import queryPoolMembers from "@/fetchers/pool/query-pool-members";
import { CONTACT_PAGE_SIZE } from "../contact/use-query-contacts";

function useQueryPoolMembers(
  poolId: string,
  q: string,
  filter: ContactFilterRequest,
) {
  return useQuery({
    queryKey: ["pool-members", poolId, q, filter],
    queryFn: () =>
      queryPoolMembers({ poolId, q, filter, limit: CONTACT_PAGE_SIZE }),
    enabled: !!poolId,
    placeholderData: keepPreviousData,
  });
}

export default useQueryPoolMembers;
