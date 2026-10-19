import { z } from "../openapi";

export const FILTER_OPERATORS = [
  "contains",
  "not_contains",
  "starts_with",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "any_of",
  "all_of",
  "none_of",
  "empty",
  "not_empty",
] as const;

export const candidateFieldType = z.enum([
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
]);

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const candidateIdParam = z.object({ id: z.string() });
export const fieldIdParam = z.object({ fieldId: z.string() });
export const taskIdParam = z.object({ taskId: z.string() });
export const candidateTaskParam = z.object({
  id: z.string(),
  taskId: z.string(),
});
export const externalIdParam = z.object({
  workspaceId: z.string(),
  externalId: z.string().min(1).max(200),
});

export const listCandidatesQuery = z.object({
  q: z.string().optional().openapi({
    description:
      "Search name, phone, email and external id (case-insensitive).",
  }),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const fieldValueInput = z
  .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
  .openapi({
    description:
      "Field value. Numbers and booleans are stored as text; arrays are stored as a JSON array for multiselect fields and joined with ', ' for text fields; null clears the value.",
  });

const coreFields = {
  name: z.string().trim().min(1).max(300),
  phone: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().max(320).nullable().optional(),
  externalId: z.string().trim().min(1).max(200).nullable().optional(),
  source: z.string().trim().max(200).nullable().optional(),
};

export const createCandidateBody = z.object({
  ...coreFields,
  fields: z.record(z.string(), fieldValueInput).optional().openapi({
    description:
      "Field values by field name. Unknown names are rejected unless createMissingFields is true.",
  }),
  createMissingFields: z.boolean().optional().default(false),
});

export const upsertCandidateBody = createCandidateBody.extend({
  name: coreFields.name.optional().openapi({
    description: "Required when the candidate does not exist yet.",
  }),
});

export const updateCandidateBody = z.object({
  name: coreFields.name.optional(),
  phone: coreFields.phone,
  email: coreFields.email,
  externalId: coreFields.externalId,
  source: coreFields.source,
});

export const setCandidateValuesBody = z.object({
  values: z.record(z.string(), fieldValueInput).openapi({
    description: "Field values by field name (case-insensitive).",
  }),
  createMissing: z.boolean().optional().default(false).openapi({
    description: "Create field definitions that do not exist yet.",
  }),
  types: z.record(z.string(), candidateFieldType).optional().openapi({
    description:
      "Type for fields created by createMissing. Defaults: number for numbers, boolean for booleans, text otherwise. dropdown/multiselect take their options from the value.",
  }),
});

export const createFieldBody = z.object({
  name: z.string().trim().min(1).max(200),
  type: candidateFieldType,
  required: z.boolean().optional().default(false),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const updateFieldBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  options: z.array(z.string()).optional(),
  position: z.number().int().optional(),
});

export const linkTaskBody = z.object({ taskId: z.string() });

export const candidateFilterCondition = z.object({
  field: z.string().min(1).openapi({
    description:
      'A core property (name, phone, email, externalId, source, createdAt, updatedAt), "field:<fieldId>" for a candidate field, or "board:<projectId>" for the candidate\'s linked task on that board (values are column ids).',
  }),
  op: z.enum(FILTER_OPERATORS),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .nullable()
    .optional(),
});

export const candidateFilter = z
  .object({
    match: z.enum(["all", "any"]).optional().default("all"),
    conditions: z.array(candidateFilterCondition).max(20),
  })
  .openapi("CandidateFilter");

export const queryCandidatesBody = z.object({
  q: listCandidatesQuery.shape.q,
  filter: candidateFilter.optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const candidateIds = z.array(z.string().min(1)).min(1).max(500);

export const bulkCandidatesBody = z.object({ ids: candidateIds });

export const bulkUpdateCandidatesBody = z.object({
  ids: candidateIds,
  source: z.string().trim().max(200).nullable().optional(),
  values: z.record(z.string(), fieldValueInput).optional().openapi({
    description:
      "Field values by field name (case-insensitive), set on every candidate; null clears.",
  }),
});
