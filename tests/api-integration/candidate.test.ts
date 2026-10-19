// Fork: Candidates API (apps/api/src/candidate).
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

async function setup(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const a = await createProjectFixture({ workspaceId: member.workspace.id });
  const b = await createProjectFixture({ workspaceId: member.workspace.id });
  const mkTask = async (projectId: string, columnId: string, title: string) =>
    (
      await db
        .insert(schema.taskTable)
        .values({ projectId, title, number: 1, status: "to-do", columnId })
        .returning()
    )[0];
  const taskA = await mkTask(
    a.project.id,
    a.columns.todo.id,
    "Nurse screening",
  );
  const taskB = await mkTask(
    b.project.id,
    b.columns.todo.id,
    "Profile details",
  );
  const { app } = createApp();
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
  return { member, a, b, taskA, taskB, app, call, ws: member.workspace.id };
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
    name: "candidate test key",
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: JSON.stringify(permissions),
    enabled: true,
  });
  return { Authorization: `Bearer ${key}` };
}

describe("candidates", () => {
  it("upserts by externalId, creating missing fields with inferred types", async () => {
    const { member, call, ws } = await setup();
    mockAuthenticatedSession(member.user);

    const first = await call("PUT", `/workspace/${ws}/external/L123`, {
      name: "Priya Sharma",
      phone: "+919876543210",
      source: "meta",
      fields: {
        "Years of experience": 5,
        "Open to relocation": true,
        Department: "ICU",
      },
      createMissingFields: true,
    });
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(true);
    expect(first.body.externalId).toBe("L123");
    const types = Object.fromEntries(
      first.body.createdFields.map((f: { name: string; type: string }) => [
        f.name,
        f.type,
      ]),
    );
    expect(types).toEqual({
      "Years of experience": "number",
      "Open to relocation": "boolean",
      Department: "text",
    });
    expect(Object.values(first.body.fields).sort()).toEqual([
      "5",
      "ICU",
      "true",
    ]);

    const second = await call("PUT", `/workspace/${ws}/external/L123`, {
      email: "priya@example.com",
      fields: { department: "Emergency" },
    });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.name).toBe("Priya Sharma");
    expect(second.body.email).toBe("priya@example.com");
    expect(Object.values(second.body.fields)).toContain("Emergency");

    const byExt = await call("GET", `/workspace/${ws}/external/L123`);
    expect(byExt.body.id).toBe(first.body.id);

    const fields = await call("GET", `/workspace/${ws}/fields`);
    expect(fields.body).toHaveLength(3);
  });

  it("requires a name to create, rejects unknown fields unless createMissing, validates types", async () => {
    const { member, call, ws } = await setup();
    mockAuthenticatedSession(member.user);
    expect(
      (await call("PUT", `/workspace/${ws}/external/NONAME`, { phone: "1" }))
        .status,
    ).toBe(400);

    const c = (await call("POST", `/workspace/${ws}`, { name: "Ravi" })).body;
    expect(
      (await call("PUT", `/${c.id}/values`, { values: { Unknown: "x" } }))
        .status,
    ).toBe(400);

    const created = await call("PUT", `/${c.id}/values`, {
      values: { Salary: "30000", "Available from": "2026-11-01" },
      createMissing: true,
      types: { Salary: "number", "Available from": "date" },
    });
    expect(created.status).toBe(200);
    expect(
      created.body.createdFields.map((f: { type: string }) => f.type).sort(),
    ).toEqual(["date", "number"]);

    expect(
      (await call("PUT", `/${c.id}/values`, { values: { Salary: "lots" } }))
        .status,
    ).toBe(400);
    expect(
      (
        await call("PUT", `/${c.id}/values`, {
          values: { Tags: ["a"] },
          createMissing: true,
          types: { Tags: "multiselect" },
        })
      ).status,
    ).toBe(400);

    const cleared = await call("PUT", `/${c.id}/values`, {
      values: { Salary: null },
    });
    expect(Object.values(cleared.body.fields)).toEqual(["2026-11-01"]);
  });

  it("links tasks across projects and lists both directions", async () => {
    const { member, call, ws, taskA, taskB, a, b } = await setup();
    mockAuthenticatedSession(member.user);
    const c = (
      await call("POST", `/workspace/${ws}`, {
        name: "Meera",
        externalId: "L9",
      })
    ).body;

    expect(
      (await call("POST", `/${c.id}/tasks`, { taskId: taskA.id })).body.created,
    ).toBe(true);
    expect(
      (await call("POST", `/${c.id}/tasks`, { taskId: taskA.id })).body.created,
    ).toBe(false);
    await call("POST", `/${c.id}/tasks`, { taskId: taskB.id });

    const tasks = (await call("GET", `/${c.id}/tasks`)).body;
    expect(tasks.map((t: { projectId: string }) => t.projectId).sort()).toEqual(
      [a.project.id, b.project.id].sort(),
    );
    expect(tasks[0]).toHaveProperty("columnName");

    const onTask = (await call("GET", `/task/${taskA.id}`)).body;
    expect(onTask.map((x: { id: string }) => x.id)).toEqual([c.id]);

    await call("DELETE", `/${c.id}/tasks/${taskB.id}`);
    expect((await call("GET", `/${c.id}/tasks`)).body).toHaveLength(1);

    // Deleting a task drops the link; deleting the candidate keeps the task.
    await db
      .delete(schema.taskTable)
      .where((await import("drizzle-orm")).eq(schema.taskTable.id, taskA.id));
    expect((await call("GET", `/${c.id}/tasks`)).body).toHaveLength(0);
    await call("POST", `/${c.id}/tasks`, { taskId: taskB.id });
    expect((await call("DELETE", `/${c.id}`)).status).toBe(200);
    const [stillThere] = await db
      .select()
      .from(schema.taskTable)
      .where((await import("drizzle-orm")).eq(schema.taskTable.id, taskB.id));
    expect(stillThere).toBeTruthy();
  });

  it("refuses links to tasks in another workspace and hides candidates from outsiders", async () => {
    const { member, call, ws } = await setup();
    const other = await setup();
    mockAuthenticatedSession(member.user);
    const c = (await call("POST", `/workspace/${ws}`, { name: "Asha" })).body;
    const cross = await call("POST", `/${c.id}/tasks`, {
      taskId: other.taskA.id,
    });
    expect([400, 403, 404]).toContain(cross.status);

    mockAuthenticatedSession(other.member.user);
    expect((await call("GET", `/${c.id}`)).status).toBe(404);
    expect((await call("GET", `/workspace/${ws}`)).status).toBe(404);
  });

  it("searches by name, phone, email and externalId", async () => {
    const { member, call, ws } = await setup();
    mockAuthenticatedSession(member.user);
    await call("POST", `/workspace/${ws}`, {
      name: "Anita Rao",
      phone: "+91 90000 11111",
    });
    await call("POST", `/workspace/${ws}`, {
      name: "Bina",
      email: "bina@x.com",
      externalId: "CRM-7",
    });
    const q = async (term: string) =>
      (await call("GET", `/workspace/${ws}?q=${encodeURIComponent(term)}`))
        .body;
    expect((await q("anita")).total).toBe(1);
    expect((await q("11111")).total).toBe(1);
    expect((await q("bina@")).total).toBe(1);
    expect((await q("crm-7")).total).toBe(1);
    expect((await q("%")).total).toBe(0);
    expect((await call("GET", `/workspace/${ws}`)).body.total).toBe(2);
  });

  it("enforces API key scopes and field-definition admin permission", async () => {
    const { member, call, ws } = await setup();
    mockAnonymousSession();
    const readOnly = await apiKeyFor(member.user.id, { task: ["read"] });
    expect(
      (await call("GET", `/workspace/${ws}`, undefined, readOnly)).status,
    ).toBe(200);
    expect(
      (await call("POST", `/workspace/${ws}`, { name: "X" }, readOnly)).status,
    ).toBe(403);

    const writer = await apiKeyFor(member.user.id, {
      task: ["create", "read", "update"],
    });
    const up = await call(
      "PUT",
      `/workspace/${ws}/external/K1`,
      { name: "Key Made", fields: { City: "Pune" }, createMissingFields: true },
      writer,
    );
    expect(up.status).toBe(200);
    expect(
      (
        await call(
          "POST",
          `/workspace/${ws}/fields`,
          { name: "Grade", type: "text" },
          writer,
        )
      ).status,
    ).toBe(403);

    const plainMember = await createWorkspaceMember({ role: "member" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: plainMember.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(plainMember.user);
    expect(
      (
        await call("POST", `/workspace/${ws}/fields`, {
          name: "Grade",
          type: "text",
        })
      ).status,
    ).toBe(403);
    mockAuthenticatedSession(member.user);
    const field = await call("POST", `/workspace/${ws}/fields`, {
      name: "Grade",
      type: "dropdown",
      options: ["A", "B"],
    });
    expect(field.status).toBe(200);
    expect(
      (
        await call("POST", `/workspace/${ws}/fields`, {
          name: "grade",
          type: "text",
        })
      ).status,
    ).toBe(409);
  });
});
