// Fork: candidates advanced filter and bulk actions (apps/api/src/candidate).
import { createHash, randomUUID } from "node:crypto";
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
    const res = await app.request(`/api/candidate${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  mockAuthenticatedSession(member.user);

  const field = async (name: string, type: string, options?: string[]) =>
    (await call("POST", `/workspace/${ws}/fields`, { name, type, options }))
      .body.id as string;
  const fields = {
    exp: await field("Experience", "number"),
    dept: await field("Department", "dropdown", ["ICU", "ER", "OT"]),
    skills: await field("Skills", "multiselect", ["BLS", "ACLS", "PALS"]),
    start: await field("Start", "date"),
    relocate: await field("Relocate", "boolean"),
    city: await field("City", "text"),
  };

  const make = async (
    name: string,
    source: string | null,
    values: Record<string, unknown>,
  ) =>
    (
      await call("POST", `/workspace/${ws}`, {
        name,
        source,
        fields: values,
      })
    ).body.id as string;
  const ids = {
    asha: await make("Asha", "meta", {
      Experience: 5,
      Department: "ICU",
      Skills: ["BLS", "ACLS"],
      Start: "2026-11-01",
      Relocate: true,
      City: "Pune",
    }),
    bina: await make("Bina", "referral", {
      Experience: "2.5",
      Department: "ER",
      Skills: ["PALS"],
      Start: "2027-01-15",
      Relocate: false,
    }),
    chitra: await make("Chitra", null, {}),
  };

  // Asha is on the board, in To do; Bina is on it, in Done.
  const task = async (
    number: number,
    columnId: string,
    candidateId: string,
  ) => {
    const [t] = await db
      .insert(schema.taskTable)
      .values({
        projectId: board.project.id,
        title: `Screening ${number}`,
        number,
        status: "to-do",
        columnId,
      })
      .returning();
    await call("POST", `/${candidateId}/tasks`, { taskId: t?.id });
  };
  await task(1, board.columns.todo.id, ids.asha);
  await task(2, board.columns.done.id, ids.bina);

  const names = async (
    conditions: Condition[],
    match: "all" | "any" = "all",
    q?: string,
  ) => {
    const res = await call("POST", `/workspace/${ws}/query`, {
      q,
      filter: { match, conditions },
      limit: 200,
    });
    expect(res.status).toBe(200);
    return (res.body.items as { name: string }[]).map((c) => c.name).sort();
  };

  return { member, ws, board, call, fields, ids, names };
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
    name: "candidate bulk test key",
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: JSON.stringify(permissions),
    enabled: true,
  });
  return { Authorization: `Bearer ${key}` };
}

describe("candidate filters", () => {
  it("filters core properties and every field type", async () => {
    const { fields: f, names, board } = await setup();

    expect(await names([{ field: "source", op: "eq", value: "META" }])).toEqual(
      ["Asha"],
    );
    expect(await names([{ field: "source", op: "empty" }])).toEqual(["Chitra"]);
    expect(
      await names([{ field: "name", op: "starts_with", value: "b" }]),
    ).toEqual(["Bina"]);
    expect(
      await names([{ field: "source", op: "not_contains", value: "ref" }]),
    ).toEqual(["Asha", "Chitra"]);

    expect(
      await names([{ field: `field:${f.exp}`, op: "gte", value: 3 }]),
    ).toEqual(["Asha"]);
    expect(
      await names([{ field: `field:${f.exp}`, op: "lt", value: "3" }]),
    ).toEqual(["Bina"]);
    expect(await names([{ field: `field:${f.exp}`, op: "empty" }])).toEqual([
      "Chitra",
    ]);

    expect(
      await names([
        { field: `field:${f.dept}`, op: "any_of", value: ["ICU", "OT"] },
      ]),
    ).toEqual(["Asha"]);
    expect(
      await names([
        { field: `field:${f.dept}`, op: "none_of", value: ["ICU"] },
      ]),
    ).toEqual(["Bina", "Chitra"]);

    expect(
      await names([
        { field: `field:${f.skills}`, op: "any_of", value: ["ACLS", "PALS"] },
      ]),
    ).toEqual(["Asha", "Bina"]);
    expect(
      await names([
        { field: `field:${f.skills}`, op: "all_of", value: ["BLS", "ACLS"] },
      ]),
    ).toEqual(["Asha"]);
    expect(
      await names([
        { field: `field:${f.skills}`, op: "none_of", value: ["BLS"] },
      ]),
    ).toEqual(["Bina", "Chitra"]);
    expect(await names([{ field: `field:${f.skills}`, op: "empty" }])).toEqual([
      "Chitra",
    ]);

    expect(
      await names([
        { field: `field:${f.start}`, op: "gt", value: "2026-12-31" },
      ]),
    ).toEqual(["Bina"]);
    expect(
      await names([
        { field: `field:${f.start}`, op: "eq", value: "2026-11-01" },
      ]),
    ).toEqual(["Asha"]);

    expect(
      await names([{ field: `field:${f.relocate}`, op: "eq", value: true }]),
    ).toEqual(["Asha"]);
    // Unset reads as unchecked.
    expect(
      await names([{ field: `field:${f.relocate}`, op: "eq", value: false }]),
    ).toEqual(["Bina", "Chitra"]);

    expect(
      await names([{ field: `field:${f.city}`, op: "contains", value: "un" }]),
    ).toEqual(["Asha"]);
    expect(
      await names([{ field: `field:${f.city}`, op: "neq", value: "pune" }]),
    ).toEqual(["Bina", "Chitra"]);

    const onBoard = `board:${board.project.id}`;
    expect(await names([{ field: onBoard, op: "not_empty" }])).toEqual([
      "Asha",
      "Bina",
    ]);
    expect(await names([{ field: onBoard, op: "empty" }])).toEqual(["Chitra"]);
    expect(
      await names([
        { field: onBoard, op: "any_of", value: [board.columns.done.id] },
      ]),
    ).toEqual(["Bina"]);
    expect(
      await names([
        { field: onBoard, op: "none_of", value: [board.columns.done.id] },
      ]),
    ).toEqual(["Asha", "Chitra"]);

    const today = new Date().toISOString().slice(0, 10);
    expect(
      await names([{ field: "createdAt", op: "lte", value: today }]),
    ).toHaveLength(3);
  });

  it("joins conditions with all/any and combines with search", async () => {
    const { fields: f, names } = await setup();
    const conditions = [
      { field: `field:${f.exp}`, op: "gte", value: 3 },
      { field: "source", op: "eq", value: "referral" },
    ];
    expect(await names(conditions, "all")).toEqual([]);
    expect(await names(conditions, "any")).toEqual(["Asha", "Bina"]);
    expect(await names(conditions, "any", "bin")).toEqual(["Bina"]);
    expect(await names([], "all")).toEqual(["Asha", "Bina", "Chitra"]);
  });

  it("rejects bad filters and boards from other workspaces", async () => {
    const { fields: f, ws, call } = await setup();
    const other = await createProjectFixture({
      workspaceId: (await createWorkspaceMember({ role: "admin" })).workspace
        .id,
    });
    const bad = async (condition: Condition) =>
      (
        await call("POST", `/workspace/${ws}/query`, {
          filter: { conditions: [condition] },
        })
      ).status;
    expect(await bad({ field: "nope", op: "eq", value: "x" })).toBe(400);
    expect(await bad({ field: "field:missing", op: "eq", value: "x" })).toBe(
      400,
    );
    expect(
      await bad({ field: `field:${f.exp}`, op: "contains", value: "1" }),
    ).toBe(400);
    expect(
      await bad({ field: `field:${f.exp}`, op: "gt", value: "many" }),
    ).toBe(400);
    expect(
      await bad({ field: `field:${f.start}`, op: "gt", value: "soon" }),
    ).toBe(400);
    expect(
      await bad({ field: `field:${f.dept}`, op: "any_of", value: [] }),
    ).toBe(400);
    expect(
      await bad({ field: `board:${other.project.id}`, op: "not_empty" }),
    ).toBe(400);
  });
});

describe("candidate bulk actions", () => {
  it("sets source and field values on many, clears with null, ignores foreign ids", async () => {
    const { ws, call, ids, fields: f, member } = await setup();
    const outsider = await setup();
    mockAuthenticatedSession(member.user);

    const res = await call("POST", `/workspace/${ws}/bulk/update`, {
      ids: [ids.asha, ids.chitra, outsider.ids.asha],
      source: "job fair",
      values: { department: "OT", Skills: ["PALS"], City: null },
    });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    for (const id of [ids.asha, ids.chitra]) {
      const c = (await call("GET", `/${id}`)).body;
      expect(c.source).toBe("job fair");
      expect(c.fields[f.dept]).toBe("OT");
      expect(JSON.parse(c.fields[f.skills])).toEqual(["PALS"]);
      expect(c.fields[f.city]).toBeUndefined();
    }
    expect((await call("GET", `/${ids.bina}`)).body.source).toBe("referral");

    expect(
      (
        await call("POST", `/workspace/${ws}/bulk/update`, {
          ids: [ids.asha],
          values: { Department: "Cardio" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", `/workspace/${ws}/bulk/update`, {
          ids: [ids.asha],
          values: { Unknown: "x" },
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("POST", `/workspace/${ws}/bulk/update`, { ids: [ids.asha] }))
        .status,
    ).toBe(400);
  });

  it("deletes many in the workspace only, and needs the delete scope", async () => {
    const { ws, call, ids, member } = await setup();
    mockAnonymousSession();
    const editor = await apiKeyFor(member.user.id, {
      task: ["read", "update"],
    });
    expect(
      (
        await call(
          "POST",
          `/workspace/${ws}/bulk/delete`,
          { ids: [ids.asha] },
          editor,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "POST",
          `/workspace/${ws}/bulk/update`,
          { ids: [ids.asha], source: "x" },
          editor,
        )
      ).status,
    ).toBe(200);

    mockAuthenticatedSession(member.user);
    const res = await call("POST", `/workspace/${ws}/bulk/delete`, {
      ids: [ids.asha, ids.bina, "not-a-candidate"],
    });
    expect(res.body).toEqual({ deleted: 2 });
    const left = (await call("GET", `/workspace/${ws}`)).body;
    expect(left.items.map((c: { name: string }) => c.name)).toEqual(["Chitra"]);
  });
});
