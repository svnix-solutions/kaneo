import type { QueryClient } from "@tanstack/react-query";

// Contacts, pools, memberships and pipelines show up in each other's lists
// and counts; after any change, refresh them all (they are small,
// workspace-scoped lists). Pipeline changes also touch board task lists.
const KEYS = [
  "contacts",
  "contact",
  "contact-pools",
  "contact-tasks",
  "task-contacts",
  "pools",
  "pool",
  "pool-fields",
  "pool-members",
  "pool-member-tasks",
  "task-pool-members",
  "tasks",
];

export function invalidateContactData(queryClient: QueryClient) {
  for (const key of KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}
