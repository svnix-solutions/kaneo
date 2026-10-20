import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { contactTable, poolFieldDefinitionTable, poolTable } from "./schema";

// Resolves the workspace from a contact, pool or pool-field id in the path,
// checks the caller's access to it, and sets c.var.workspaceId -- the same
// contract as utils/workspace-access-middleware, without editing that file.
function fromLookup(
  lookup: (id: string) => Promise<{ workspaceId: string } | undefined>,
  idKey: string,
  notFound: string,
) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });
    const id = c.req.param(idKey);
    if (!id) throw new HTTPException(400, { message: `${idKey} is required` });
    const row = await lookup(id);
    if (!row) throw new HTTPException(404, { message: notFound });
    await validateWorkspaceAccess(
      userId,
      row.workspaceId,
      c.get("apiKey")?.id,
      { notFoundMessage: notFound },
    );
    c.set("workspaceId", row.workspaceId);
    return next();
  };
}

const contactWorkspace = async (id: string) =>
  (
    await db
      .select({ workspaceId: contactTable.workspaceId })
      .from(contactTable)
      .where(eq(contactTable.id, id))
      .limit(1)
  )[0];

const poolWorkspace = async (id: string) =>
  (
    await db
      .select({ workspaceId: poolTable.workspaceId })
      .from(poolTable)
      .where(eq(poolTable.id, id))
      .limit(1)
  )[0];

const fieldWorkspace = async (id: string) =>
  (
    await db
      .select({ workspaceId: poolTable.workspaceId })
      .from(poolFieldDefinitionTable)
      .innerJoin(poolTable, eq(poolTable.id, poolFieldDefinitionTable.poolId))
      .where(eq(poolFieldDefinitionTable.id, id))
      .limit(1)
  )[0];

export const contactAccess = {
  fromContact: (idKey = "id") =>
    fromLookup(contactWorkspace, idKey, "Contact not found"),
  fromPool: (idKey = "poolId") =>
    fromLookup(poolWorkspace, idKey, "Pool not found"),
  fromField: (idKey = "fieldId") =>
    fromLookup(fieldWorkspace, idKey, "Pool field not found"),
};
