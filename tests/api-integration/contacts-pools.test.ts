// Fork: contacts and pools (apps/api/src/contact).
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

type Condition = { field: string; op: string; value?: unknown };

async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const board = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const { app } = createApp();
  const ws = member.workspace.id;
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  mockAuthenticatedSession(member.user);
  const contact = async (externalId: string, body: Record<string, unknown>) =>
    (await call("PUT", `/contact/workspace/${ws}/external/${externalId}`, body))
      .body;
  const newPool = async (name: string, slug?: string) =>
    (await call("POST", `/pool/workspace/${ws}`, { name, slug })).body;
  let taskNumber = 0;
  const task = async (columnId: string, contactId: string) => {
    const [t] = await db
      .insert(schema.taskTable)
      .values({
        projectId: board.project.id,
        title: `Task ${++taskNumber}`,
        number: taskNumber,
        status: "to-do",
        columnId,
      })
      .returning();
    await call("POST", `/contact/${contactId}/tasks`, { taskId: t?.id });
    return t;
  };
  return { member, ws, board, call, contact, newPool, task };
}

async function apiKeyFor(
  userId: string,
  permissions: Record<string, string[]>,
) {
  const key = `kaneo_test_${randomUUID()}`;
  await db.insert(schema.apikeyTable).values({
    referenceId: userId,
    userId,
    key: createHash("sha256").update(key).digest("base64url"),
    name: "contacts test key",
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: JSON.stringify(permissions),
    enabled: true,
  });
  return { Authorization: `Bearer ${key}` };
}

// Asha and Bina in the nurse pool with fields; Chitra in the electrician
// pool; Deepa in no pool. Asha's task is in To do, Bina's in Done.
async function seeded() {
  const s = await setup();
  const { call, contact, newPool, task, board } = s;
  const nurse = await newPool("Nurse pool", "nurse");
  const electrician = await newPool("Electrician pool");
  const ids = {
    asha: (await contact("L1", { name: "Asha", source: "meta" })).id,
    bina: (await contact("L2", { name: "Bina", source: "referral" })).id,
    chitra: (await contact("L3", { name: "Chitra" })).id,
    deepa: (await contact("L4", { name: "Deepa", phone: "+91 98" })).id,
  };
  await call("POST", `/pool/${nurse.id}/fields`, {
    name: "Department",
    type: "dropdown",
    options: ["ICU", "ER"],
  });
  await call("POST", `/pool/${nurse.id}/fields`, {
    name: "Skills",
    type: "multiselect",
    options: ["BLS", "ACLS", "PALS"],
  });
  const enrich = (poolId: string, ext: string, values: unknown) =>
    call("PUT", `/pool/${poolId}/external/${ext}`, {
      values,
      createMissing: true,
    });
  await enrich(nurse.id, "L1", {
    Experience: 5,
    Department: "ICU",
    Skills: ["BLS", "ACLS"],
    "Resume link": "https://x.test/asha.pdf",
  });
  await enrich(nurse.id, "L2", {
    Experience: "2",
    Department: "ER",
    Skills: ["PALS"],
  });
  await enrich(electrician.id, "L3", { Licence: "Class A" });
  await task(board.columns.todo.id, ids.asha);
  await task(board.columns.done.id, ids.bina);
  const fieldIds = Object.fromEntries(
    (await call("GET", `/pool/${nurse.id}/fields`)).body.map(
      (f: { name: string; id: string }) => [f.name, f.id],
    ),
  );
  const members = async (
    poolId: string,
    conditions: Condition[] = [],
    match: "all" | "any" = "all",
    q?: string,
  ) => {
    const res = await call("POST", `/pool/${poolId}/query`, {
      q,
      filter: { match, conditions },
      limit: 200,
    });
    expect(res.status).toBe(200);
    return (res.body.items as { name: string }[]).map((c) => c.name).sort();
  };
  const contacts = async (conditions: Condition[]) => {
    const res = await call("POST", `/contact/workspace/${s.ws}/query`, {
      filter: { conditions },
      limit: 200,
    });
    expect(res.status).toBe(200);
    return (res.body.items as { name: string }[]).map((c) => c.name).sort();
  };
  return { ...s, nurse, electrician, ids, fieldIds, members, contacts };
}

describe("contacts", () => {
  it("upserts by external id, requires a name to create, and searches", async () => {
    const { call, ws, contact } = await setup();
    const first = await contact("L123", { name: "Priya", phone: "+91 9000" });
    expect(first.created).toBe(true);
    expect(first.pools).toEqual([]);
    const again = await contact("L123", { email: "p@x.com" });
    expect(again.created).toBe(false);
    expect(again.id).toBe(first.id);
    expect(again.name).toBe("Priya");
    expect(again.email).toBe("p@x.com");
    expect(
      (await call("PUT", `/contact/workspace/${ws}/external/NONAME`, {}))
        .status,
    ).toBe(400);
    expect(
      (
        await call("POST", `/contact/workspace/${ws}`, {
          name: "X",
          externalId: "L123",
        })
      ).status,
    ).toBe(409);
    const q = async (term: string) =>
      (
        await call(
          "GET",
          `/contact/workspace/${ws}?q=${encodeURIComponent(term)}`,
        )
      ).body.total;
    expect(await q("9000")).toBe(1);
    expect(await q("l123")).toBe(1);
    expect(await q("%")).toBe(0);
  });

  it("links tasks and lists them both ways; deleting a contact keeps tasks", async () => {
    const { call, contact, task, board } = await setup();
    const c = await contact("L9", { name: "Meera" });
    const t = await task(board.columns.todo.id, c.id);
    expect((await call("GET", `/contact/${c.id}/tasks`)).body).toHaveLength(1);
    expect(
      (await call("GET", `/contact/task/${t?.id}`)).body.map(
        (x: { id: string }) => x.id,
      ),
    ).toEqual([c.id]);
    await call("DELETE", `/contact/${c.id}/tasks/${t?.id}`);
    expect((await call("GET", `/contact/${c.id}/tasks`)).body).toHaveLength(0);
    await call("POST", `/contact/${c.id}/tasks`, { taskId: t?.id });
    expect((await call("DELETE", `/contact/${c.id}`)).status).toBe(200);
    const [still] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, t?.id ?? ""));
    expect(still).toBeTruthy();
  });

  it("hides contacts and pools from other workspaces", async () => {
    const { contact, newPool, ws } = await setup();
    const c = await contact("L1", { name: "Asha" });
    const pool = await newPool("Nurse pool");
    const other = await setup();
    expect((await other.call("GET", `/contact/${c.id}`)).status).toBe(404);
    expect((await other.call("GET", `/pool/${pool.id}`)).status).toBe(404);
    expect((await other.call("GET", `/contact/workspace/${ws}`)).status).toBe(
      404,
    );
    // A contact from one workspace cannot join another workspace's pool.
    const theirPool = await other.newPool("Theirs");
    expect(
      (await other.call("PUT", `/pool/${theirPool.id}/members/${c.id}`, {}))
        .status,
    ).toBe(400);
  });
});

describe("pools", () => {
  it("creates pools with derived unique slugs, finds by slug, renames, deletes keeping contacts", async () => {
    const { call, ws, newPool, contact } = await setup();
    const a = await newPool("Nurse Pool");
    const b = await newPool("Nurse pool!");
    expect(a.slug).toBe("nurse-pool");
    expect(b.slug).toBe("nurse-pool-2");
    expect(
      (
        await call("POST", `/pool/workspace/${ws}`, {
          name: "X",
          slug: "nurse-pool",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("POST", `/pool/workspace/${ws}`, {
          name: "X",
          slug: "Bad Slug",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("GET", `/pool/workspace/${ws}/slug/nurse-pool`)).body.id,
    ).toBe(a.id);
    expect((await call("GET", `/pool/workspace/${ws}/slug/nope`)).status).toBe(
      404,
    );

    const c = await contact("L1", { name: "Asha" });
    await call("PUT", `/pool/${a.id}/members/${c.id}`, {});
    expect(
      (await call("PUT", `/pool/${a.id}`, { name: "Nurses" })).body,
    ).toMatchObject({ name: "Nurses", memberCount: 1 });
    expect((await call("GET", `/pool/workspace/${ws}`)).body).toHaveLength(2);
    expect((await call("DELETE", `/pool/${a.id}`)).status).toBe(200);
    expect((await call("GET", `/contact/${c.id}`)).body.pools).toEqual([]);
  });

  it("enriches by external id: contact must exist, fields per pool, idempotent", async () => {
    const { call, newPool, contact } = await setup();
    const nurse = await newPool("Nurse pool", "nurse");
    const electrician = await newPool("Electrician pool");
    expect(
      (await call("PUT", `/pool/${nurse.id}/external/MISSING`, { values: {} }))
        .status,
    ).toBe(404);
    const c = await contact("L1", { name: "Asha" });

    const first = await call("PUT", `/pool/${nurse.id}/external/L1`, {
      values: { Experience: 5, City: "Pune", Relocate: true },
      createMissing: true,
    });
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(true);
    expect(
      Object.fromEntries(
        first.body.createdFields.map((f: { name: string; type: string }) => [
          f.name,
          f.type,
        ]),
      ),
    ).toEqual({ Experience: "number", City: "text", Relocate: "boolean" });

    const second = await call("PUT", `/pool/${nurse.id}/external/L1`, {
      values: { city: "Kochi", Experience: null },
    });
    expect(second.body.created).toBe(false);
    expect(second.body.memberId).toBe(first.body.memberId);
    expect(Object.values(second.body.fields).sort()).toEqual(["Kochi", "true"]);
    expect(
      (
        await call("PUT", `/pool/${nurse.id}/external/L1`, {
          values: { Unknown: "x" },
        })
      ).status,
    ).toBe(400);

    // Fields belong to their pool: the electrician pool starts empty.
    expect((await call("GET", `/pool/${electrician.id}/fields`)).body).toEqual(
      [],
    );
    await call("PUT", `/pool/${electrician.id}/members/${c.id}`, {
      values: { City: "Pune" },
      createMissing: true,
    });
    const contactView = (await call("GET", `/contact/${c.id}`)).body;
    expect(
      contactView.pools.map((p: { slug: string }) => p.slug).sort(),
    ).toEqual(["electrician-pool", "nurse"]);
    const memberships = (await call("GET", `/contact/${c.id}/pools`)).body;
    expect(memberships).toHaveLength(2);
    expect(
      memberships.find(
        (m: { pool: { slug: string } }) => m.pool.slug === "nurse",
      ).fields,
    ).toEqual(second.body.fields);

    await call("DELETE", `/pool/${nurse.id}/members/${c.id}`);
    expect((await call("GET", `/contact/${c.id}`)).body.pools).toHaveLength(1);
  });

  it("filters members on contact properties, pool fields and board stages", async () => {
    const { nurse, electrician, fieldIds: f, members, board } = await seeded();
    expect(await members(nurse.id)).toEqual(["Asha", "Bina"]);
    expect(await members(electrician.id)).toEqual(["Chitra"]);
    expect(
      await members(nurse.id, [
        { field: `field:${f.Experience}`, op: "gte", value: 3 },
      ]),
    ).toEqual(["Asha"]);
    expect(
      await members(nurse.id, [
        { field: `field:${f.Department}`, op: "any_of", value: ["ER"] },
      ]),
    ).toEqual(["Bina"]);
    expect(
      await members(nurse.id, [
        { field: `field:${f.Skills}`, op: "all_of", value: ["BLS", "ACLS"] },
      ]),
    ).toEqual(["Asha"]);
    expect(
      await members(nurse.id, [
        { field: "source", op: "eq", value: "REFERRAL" },
      ]),
    ).toEqual(["Bina"]);
    expect(
      await members(nurse.id, [
        {
          field: `board:${board.project.id}`,
          op: "any_of",
          value: [board.columns.done.id],
        },
      ]),
    ).toEqual(["Bina"]);
    expect(
      await members(
        nurse.id,
        [
          { field: `field:${f.Experience}`, op: "gte", value: 3 },
          { field: "source", op: "eq", value: "referral" },
        ],
        "any",
      ),
    ).toEqual(["Asha", "Bina"]);
    expect(await members(nurse.id, [], "all", "bin")).toEqual(["Bina"]);
  });

  it("filters contacts by pool membership, and rejects pool fields outside a pool", async () => {
    const {
      nurse,
      electrician,
      fieldIds: f,
      contacts,
      call,
      ws,
    } = await seeded();
    expect(
      await contacts([{ field: "pools", op: "any_of", value: [nurse.id] }]),
    ).toEqual(["Asha", "Bina"]);
    expect(
      await contacts([{ field: "pools", op: "none_of", value: [nurse.id] }]),
    ).toEqual(["Chitra", "Deepa"]);
    expect(await contacts([{ field: "pools", op: "empty" }])).toEqual([
      "Deepa",
    ]);
    expect(
      await contacts([
        { field: "pools", op: "all_of", value: [nurse.id, electrician.id] },
      ]),
    ).toEqual([]);
    const bad = async (path: string, condition: Condition) =>
      (await call("POST", path, { filter: { conditions: [condition] } }))
        .status;
    expect(
      await bad(`/contact/workspace/${ws}/query`, {
        field: `field:${f.Experience}`,
        op: "gte",
        value: 1,
      }),
    ).toBe(400);
    // A field of another pool is unknown here.
    expect(
      await bad(`/pool/${electrician.id}/query`, {
        field: `field:${f.Experience}`,
        op: "gte",
        value: 1,
      }),
    ).toBe(400);
    expect(
      await bad(`/pool/${nurse.id}/query`, { field: "pools", op: "empty" }),
    ).toBe(400);
  });

  it("bulk: add to pool, set values, remove; contacts bulk source and delete", async () => {
    const {
      call,
      ws,
      nurse,
      ids,
      fieldIds: f,
      members,
      member,
    } = await seeded();
    const other = await setup();
    const foreign = (await other.contact("X1", { name: "Foreign" })).id;
    mockAuthenticatedSession(member.user);

    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/add`, {
          ids: [ids.asha, ids.chitra, ids.deepa, foreign],
        })
      ).body,
    ).toEqual({ added: 2 });
    expect(await members(nurse.id)).toEqual([
      "Asha",
      "Bina",
      "Chitra",
      "Deepa",
    ]);

    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/update`, {
          ids: [ids.chitra, ids.deepa, foreign],
          values: { Department: "ICU" },
        })
      ).body,
    ).toEqual({ updated: 2 });
    expect(
      await members(nurse.id, [
        { field: `field:${f.Department}`, op: "any_of", value: ["ICU"] },
      ]),
    ).toEqual(["Asha", "Chitra", "Deepa"]);
    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/update`, {
          ids: [ids.chitra],
          values: { Department: "Cardio" },
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/remove`, {
          ids: [ids.chitra, ids.deepa],
        })
      ).body,
    ).toEqual({ removed: 2 });
    // Removing from a pool keeps the contact.
    expect((await call("GET", `/contact/${ids.deepa}`)).status).toBe(200);

    expect(
      (
        await call("POST", `/contact/workspace/${ws}/bulk/update`, {
          ids: [ids.asha, ids.bina, foreign],
          source: "job fair",
        })
      ).body,
    ).toEqual({ updated: 2 });
    expect(
      (
        await call("POST", `/contact/workspace/${ws}/bulk/delete`, {
          ids: [ids.asha, foreign],
        })
      ).body,
    ).toEqual({ deleted: 1 });
    expect(await members(nurse.id)).toEqual(["Bina"]);
  });

  it("gates pool management like projects and fields like settings", async () => {
    const { member, ws, call, newPool } = await setup();
    const pool = await newPool("Nurse pool");
    mockAnonymousSession();
    const taskOnly = await apiKeyFor(member.user.id, {
      task: ["create", "read", "update"],
    });
    expect(
      (await call("POST", `/pool/workspace/${ws}`, { name: "Y" }, taskOnly))
        .status,
    ).toBe(403);
    expect(
      (await call("DELETE", `/pool/${pool.id}`, undefined, taskOnly)).status,
    ).toBe(403);
    expect(
      (
        await call(
          "POST",
          `/pool/${pool.id}/fields`,
          { name: "Grade", type: "text" },
          taskOnly,
        )
      ).status,
    ).toBe(403);
    // The integration path: a task-scoped key can upsert contacts and enrich members.
    await call(
      "PUT",
      `/contact/workspace/${ws}/external/K1`,
      { name: "Key Made" },
      taskOnly,
    );
    expect(
      (
        await call(
          "PUT",
          `/pool/${pool.id}/external/K1`,
          { values: { City: "Pune" }, createMissing: true },
          taskOnly,
        )
      ).status,
    ).toBe(200);
    const readOnly = await apiKeyFor(member.user.id, { task: ["read"] });
    expect(
      (
        await call(
          "PUT",
          `/pool/${pool.id}/external/K1`,
          { values: {} },
          readOnly,
        )
      ).status,
    ).toBe(403);
  });
});

describe("pipelines", () => {
  it("puts members on a board once, links tasks to members, and shows them on the pool", async () => {
    const { call, nurse, ids, members, ws } = await seeded();
    const client = await createProjectFixture({ workspaceId: ws });
    const add = (body: Record<string, unknown>) =>
      call("POST", `/pool/${nurse.id}/bulk/add-to-board`, {
        projectId: client.project.id,
        ...body,
      });

    const first = await add({ ids: [ids.asha, ids.bina, ids.deepa] });
    expect(first.status).toBe(200);
    // Deepa is not in the nurse pool: ignored.
    expect(first.body).toMatchObject({ added: 2, skipped: 0 });
    expect((await add({ ids: [ids.asha] })).body).toMatchObject({
      added: 0,
      skipped: 1,
    });

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, client.project.id));
    expect(tasks.map((t) => t.title).sort()).toEqual(["Asha", "Bina"]);
    // First stage by default, numbered like any board task.
    expect(new Set(tasks.map((t) => t.columnId))).toEqual(
      new Set([client.columns.todo.id]),
    );
    expect(tasks.every((t) => (t.number ?? 0) > 0)).toBe(true);

    const rows = (await call("POST", `/pool/${nurse.id}/query`, { limit: 200 }))
      .body.items as {
      name: string;
      pipelines: { projectId: string; columnName: string }[];
    }[];
    const asha = rows.find((r) => r.name === "Asha");
    expect(asha?.pipelines).toHaveLength(1);
    expect(asha?.pipelines[0]).toMatchObject({
      projectId: client.project.id,
      columnName: client.columns.todo.name,
    });

    // The board filter matches member-linked tasks, on the pool and on contacts.
    const onClient = { field: `board:${client.project.id}`, op: "not_empty" };
    expect(await members(nurse.id, [onClient])).toEqual(["Asha", "Bina"]);
    const contactsOnClient = (
      await call("POST", `/contact/workspace/${ws}/query`, {
        filter: { conditions: [onClient] },
      })
    ).body.items
      .map((c: { name: string }) => c.name)
      .sort();
    expect(contactsOnClient).toEqual(["Asha", "Bina"]);

    // A chosen stage, and the task page lists the member.
    const chitraJoins = await call(
      "PUT",
      `/pool/${nurse.id}/members/${ids.chitra}`,
      {},
    );
    expect(chitraJoins.status).toBe(200);
    const later = await add({
      ids: [ids.chitra],
      columnId: client.columns.inReview.id,
    });
    const [chitraTask] = later.body.taskIds;
    const onTask = (await call("GET", `/pool/task/${chitraTask}/members`)).body;
    expect(onTask).toHaveLength(1);
    expect(onTask[0]).toMatchObject({
      name: "Chitra",
      pool: { slug: "nurse" },
    });
    const [moved] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, chitraTask));
    expect(moved?.columnId).toBe(client.columns.inReview.id);

    // Removing the member drops the link; the task stays.
    await call("DELETE", `/pool/${nurse.id}/members/${ids.chitra}`);
    expect(
      (await call("GET", `/pool/task/${chitraTask}/members`)).body,
    ).toEqual([]);
    const [kept] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, chitraTask));
    expect(kept).toBeTruthy();
  });

  it("links and unlinks existing tasks; refuses foreign boards and non-members", async () => {
    const { call, nurse, ids, board } = await seeded();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: board.project.id,
        title: "Interview Asha",
        number: 99,
        status: "to-do",
        columnId: board.columns.todo.id,
      })
      .returning();
    const path = `/pool/${nurse.id}/members/${ids.asha}/tasks`;
    expect((await call("POST", path, { taskId: task?.id })).body.created).toBe(
      true,
    );
    expect((await call("POST", path, { taskId: task?.id })).body.created).toBe(
      false,
    );
    expect(
      (await call("GET", path)).body.map((t: { taskId: string }) => t.taskId),
    ).toContain(task?.id);
    await call("DELETE", `${path}/${task?.id}`);
    expect(
      (await call("GET", path)).body.map((t: { taskId: string }) => t.taskId),
    ).not.toContain(task?.id);

    expect(
      (await call("GET", `/pool/${nurse.id}/members/${ids.deepa}/tasks`))
        .status,
    ).toBe(404);
    const other = await createProjectFixture({
      workspaceId: (await createWorkspaceMember({ role: "admin" })).workspace
        .id,
    });
    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/add-to-board`, {
          ids: [ids.asha],
          projectId: other.project.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", `/pool/${nurse.id}/bulk/add-to-board`, {
          ids: [ids.asha],
          projectId: board.project.id,
          columnId: "nope",
        })
      ).status,
    ).toBe(400);
  });
});
