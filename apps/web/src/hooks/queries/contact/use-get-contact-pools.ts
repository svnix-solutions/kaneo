import { useQuery } from "@tanstack/react-query";
import getContactPools from "@/fetchers/contact/get-contact-pools";

function useGetContactPools(id: string) {
  return useQuery({
    queryKey: ["contact-pools", id],
    queryFn: () => getContactPools(id),
    enabled: !!id,
  });
}

export default useGetContactPools;
