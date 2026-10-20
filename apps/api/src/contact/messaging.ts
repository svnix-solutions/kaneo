// Manual messages (fork: svnix-solutions/kaneo): recruiters send a Typebot
// message flow, or a one-off email / WhatsApp, to selected contacts. Kaneo
// holds no messaging credentials: the glue sends (GLUE_URL + GLUE_TOKEN).
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { serializeContactCore } from "./contacts";
import { badRequest, notFound } from "./fields";
import {
  contactTable,
  messageFlowTable as flowTable,
  poolTable,
} from "./schema";

function serializeFlow(f: typeof flowTable.$inferSelect) {
  return {
    id: f.id,
    name: f.name,
    typebotPublicId: f.typebotPublicId,
    description: f.description,
    position: f.position,
  };
}

export async function listFlows(workspaceId: string) {
  const rows = await db
    .select()
    .from(flowTable)
    .where(eq(flowTable.workspaceId, workspaceId))
    .orderBy(asc(flowTable.position), asc(flowTable.name));
  return rows.map(serializeFlow);
}

/** Replace the workspace's message flows, in the given order. */
export async function replaceFlows(
  workspaceId: string,
  flows: {
    name: string;
    typebotPublicId: string;
    description?: string | null;
  }[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(flowTable).where(eq(flowTable.workspaceId, workspaceId));
    if (flows.length) {
      await tx.insert(flowTable).values(
        flows.map((f, position) => ({
          workspaceId,
          name: f.name.trim(),
          typebotPublicId: f.typebotPublicId.trim(),
          description: f.description?.trim() || null,
          position,
        })),
      );
    }
  });
  return listFlows(workspaceId);
}

export type Compose = {
  channel: "email" | "whatsapp";
  subject?: string;
  body?: string;
  template?: { name: string; language?: string; params?: string[] };
};

/** Send a flow or a composed message to contacts, through the glue. */
export async function sendMessages(
  workspaceId: string,
  body: { ids: string[]; poolId?: string; flowId?: string; compose?: Compose },
) {
  const url = process.env.GLUE_URL?.replace(/\/$/, "");
  const token = process.env.GLUE_TOKEN;
  if (!url || !token)
    throw new HTTPException(503, {
      message: "Messaging is not configured (GLUE_URL, GLUE_TOKEN)",
    });
  if (!body.flowId === !body.compose)
    badRequest("Give either a flow or a message");

  const contacts = await db
    .select()
    .from(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        inArray(contactTable.id, [...new Set(body.ids)]),
      ),
    );
  if (contacts.length === 0)
    return { sent: 0, skipped: 0, failed: 0, results: [] };

  let pool: { name: string; slug: string } | null = null;
  if (body.poolId) {
    const [row] = await db
      .select({ name: poolTable.name, slug: poolTable.slug })
      .from(poolTable)
      .where(
        and(
          eq(poolTable.id, body.poolId),
          eq(poolTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    pool = row ?? notFound("Pool not found");
  }
  let flow: { name: string; typebotPublicId: string } | null = null;
  if (body.flowId) {
    const [row] = await db
      .select({
        name: flowTable.name,
        typebotPublicId: flowTable.typebotPublicId,
      })
      .from(flowTable)
      .where(
        and(
          eq(flowTable.id, body.flowId),
          eq(flowTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    flow = row ?? notFound("Message flow not found");
  }
  if (body.compose) {
    const c = body.compose;
    if (c.channel === "email" && (!c.subject?.trim() || !c.body?.trim()))
      badRequest("An email needs a subject and a body");
    if (c.channel === "whatsapp" && !c.body?.trim() && !c.template?.name)
      badRequest("A WhatsApp message needs text or a template");
  }

  const res = await fetch(`${url}/messages/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contacts: contacts.map(serializeContactCore),
      pool,
      flow,
      compose: body.compose ?? null,
    }),
  });
  const text = await res.text();
  if (!res.ok)
    throw new HTTPException(502, {
      message: `The glue refused the send (${res.status}): ${text.slice(0, 200)}`,
    });
  return JSON.parse(text) as {
    sent: number;
    skipped: number;
    failed: number;
    results: { contactId: string; status: string; error?: string }[];
  };
}
