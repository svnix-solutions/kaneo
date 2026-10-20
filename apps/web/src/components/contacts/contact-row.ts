/**
 * A row of the contacts table: a contact (with the pools it is in) on the
 * Contacts page, or a pool member (with that pool's field values and its
 * pipeline tasks) on a pool page.
 */
export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  externalId: string | null;
  source: string | null;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  fields?: Record<string, string | null>;
  pools?: { id: string; name: string; slug: string }[];
  /** Pools the contact is meant for (Contacts page). */
  targetPools?: { id: string; name: string; slug: string }[];
  /** Pool pages: the member's tasks on pipeline boards. */
  pipelines?: {
    taskId: string;
    projectId: string;
    projectName: string;
    columnName: string | null;
    isFinal: boolean;
  }[];
};
