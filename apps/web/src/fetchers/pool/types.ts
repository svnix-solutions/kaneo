import type getPool from "./get-pool";
import type getPoolMemberTasks from "./get-pool-member-tasks";
import type getPoolFields from "./get-pool-fields";
import type queryPoolMembers from "./query-pool-members";

export type Pool = Awaited<ReturnType<typeof getPool>>;
export type PoolField = Awaited<ReturnType<typeof getPoolFields>>[number];
export type PoolMember = Awaited<
  ReturnType<typeof queryPoolMembers>
>["items"][number];
export type Pipeline = Awaited<ReturnType<typeof getPoolMemberTasks>>[number];
