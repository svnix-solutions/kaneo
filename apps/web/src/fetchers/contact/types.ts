import type getContact from "./get-contact";
import type getContactPools from "./get-contact-pools";
import type getContactTasks from "./get-contact-tasks";

export type Contact = Awaited<ReturnType<typeof getContact>>;
export type ContactMembership = Awaited<
  ReturnType<typeof getContactPools>
>[number];
export type ContactTask = Awaited<ReturnType<typeof getContactTasks>>[number];
