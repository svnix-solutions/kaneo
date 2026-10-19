import { z } from "../openapi";

export const candidateFieldDefinitionSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
    options: z.array(z.string()).nullable(),
    position: z.number(),
  })
  .openapi("CandidateFieldDefinition");

export const candidateSchema = z
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
    fields: z.record(z.string(), z.string().nullable()).openapi({
      description: "Field values keyed by field id.",
    }),
  })
  .openapi("Candidate");

export const candidateListSchema = z.object({
  items: z.array(candidateSchema),
  total: z.number(),
});

export const candidateUpsertSchema = candidateSchema.extend({
  created: z.boolean(),
  createdFields: z.array(candidateFieldDefinitionSchema),
});

export const setValuesResponseSchema = z.object({
  fields: z.record(z.string(), z.string().nullable()),
  createdFields: z.array(candidateFieldDefinitionSchema),
});

export const candidateTaskSchema = z
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
  .openapi("CandidateTask");

export const linkResponseSchema = z.object({
  taskId: z.string(),
  candidateId: z.string(),
  created: z.boolean(),
});

export const successSchema = z.object({ success: z.boolean() });
