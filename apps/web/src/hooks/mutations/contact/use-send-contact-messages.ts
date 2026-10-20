import { useMutation } from "@tanstack/react-query";
import sendContactMessages from "@/fetchers/contact/send-contact-messages";

function useSendContactMessages() {
  return useMutation({ mutationFn: sendContactMessages });
}

export default useSendContactMessages;
