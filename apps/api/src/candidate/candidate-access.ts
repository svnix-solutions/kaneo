import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { candidateFieldDefinitionTable, candidateTable } from "./schema";

// Resolves the workspace from a candidate (or candidate field) id in the path,
// checks the caller's access to it, and sets c.var.workspaceId -- the same
// contract as utils/workspace-access-middleware, without editing that file.
function fromLookup(
  table: typeof candidateTable | typeof candidateFieldDefinitionTable,
  idKey: string,
  notFound: string,
) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });
    const id = c.req.param(idKey);
    if (!id) throw new HTTPException(400, { message: `${idKey} is required` });
    const [row] = await db
      .select({ workspaceId: table.workspaceId })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (!row) throw new HTTPException(404, { message: notFound });
    await validateWorkspaceAccess(
      userId,
      row.workspaceId,
      c.get("apiKey")?.id,
      {
        notFoundMessage: notFound,
      },
    );
    c.set("workspaceId", row.workspaceId);
    return next();
  };
}

export const candidateAccess = {
  fromCandidate: (idKey = "id") =>
    fromLookup(candidateTable, idKey, "Candidate not found"),
  fromField: (idKey = "fieldId") =>
    fromLookup(
      candidateFieldDefinitionTable,
      idKey,
      "Candidate field not found",
    ),
};
