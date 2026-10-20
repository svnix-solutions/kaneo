import { useQuery } from "@tanstack/react-query";
import getContact from "@/fetchers/contact/get-contact";

function useGetContact(id: string) {
  return useQuery({
    queryKey: ["contact", id],
    queryFn: () => getContact(id),
    enabled: !!id,
  });
}

export default useGetContact;
