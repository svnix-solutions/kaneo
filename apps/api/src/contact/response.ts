import { z } from "../openapi";

export const poolRefSchema = z
  .object({ id: z.string(), name: z.string(), slug: z.string() })
  .openapi("PoolRef");

export const contactSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    externalId: z.string().nullable(),
    source: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    pools: z.array(poolRefSchema),
  })
  .openapi("Contact");

export const contactListSchema = z.object({
  items: z.array(contactSchema),
  total: z.number(),
});

export const contactUpsertSchema = contactSchema.extend({
  created: z.boolean(),
});

export const poolSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    position: z.number(),
    memberCount: z.number(),
    createdAt: z.string(),
  })
  .openapi("Pool");

export const poolFieldDefinitionSchema = z
  .object({
    id: z.string(),
    poolId: z.string(),
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
    options: z.array(z.string()).nullable(),
    position: z.number(),
  })
  .openapi("PoolFieldDefinition");

const fieldValues = z.record(z.string(), z.string().nullable()).openapi({
  description: "Pool field values keyed by field id.",
});

// A contact as a row of a pool: the contact's own properties (id is the
// contact id) plus the membership and its field values.
export const poolMemberSchema = contactSchema
  .omit({ pools: true })
  .extend({
    memberId: z.string(),
    poolId: z.string(),
    joinedAt: z.string(),
    fields: fieldValues,
  })
  .openapi("PoolMember");

export const poolMemberListSchema = z.object({
  items: z.array(poolMemberSchema),
  total: z.number(),
});

export const poolMemberUpsertSchema = poolMemberSchema.extend({
  created: z.boolean(),
  createdFields: z.array(poolFieldDefinitionSchema),
});

// One pool a contact is in, for the contact page.
export const contactMembershipSchema = z
  .object({
    memberId: z.string(),
    joinedAt: z.string(),
    pool: poolRefSchema,
    fields: fieldValues,
  })
  .openapi("ContactMembership");

export const contactTaskSchema = z
  .object({
    taskId: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    status: z.string(),
    priority: z.string().nullable(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
    columnName: z.string().nullable(),
    linkedAt: z.string(),
  })
  .openapi("ContactTask");

export const linkResponseSchema = z.object({
  taskId: z.string(),
  contactId: z.string(),
  created: z.boolean(),
});

export const successSchema = z.object({ success: z.boolean() });
export const bulkUpdateResponseSchema = z.object({ updated: z.number() });
export const bulkDeleteResponseSchema = z.object({ deleted: z.number() });
export const bulkAddResponseSchema = z.object({ added: z.number() });
export const bulkRemoveResponseSchema = z.object({ removed: z.number() });
