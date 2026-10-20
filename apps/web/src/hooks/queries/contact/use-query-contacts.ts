import { keepPreviousData, useQuery } from "@tanstack/react-query";
import queryContacts, {
  type ContactFilterRequest,
} from "@/fetchers/contact/query-contacts";

// The API caps a page at 200; list pages show one page and the total.
export const CONTACT_PAGE_SIZE = 200;

const NO_FILTER: ContactFilterRequest = { match: "all", conditions: [] };

function useQueryContacts(
  workspaceId: string,
  q = "",
  filter: ContactFilterRequest = NO_FILTER,
) {
  return useQuery({
    queryKey: ["contacts", workspaceId, q, filter],
    queryFn: () =>
      queryContacts({ workspaceId, q, filter, limit: CONTACT_PAGE_SIZE }),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export default useQueryContacts;
