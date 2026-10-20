import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type ComposeInput = {
  channel: "email" | "whatsapp";
  subject?: string;
  body?: string;
  template?: { name: string; language?: string; params?: string[] };
};

export type SendMessagesRequest = {
  workspaceId: string;
  ids: string[];
  poolId?: string;
  flowId?: string;
  compose?: ComposeInput;
};

async function sendContactMessages({
  workspaceId,
  ...json
}: SendMessagesRequest) {
  const response = await client.contact.workspace[
    ":workspaceId"
  ].bulk.message.$post({
    param: { workspaceId },
    json,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default sendContactMessages;
