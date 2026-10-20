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

export const poolFieldType = z.enum([
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
]);

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const contactIdParam = z.object({ id: z.string() });
export const poolIdParam = z.object({ poolId: z.string() });
export const fieldIdParam = z.object({ fieldId: z.string() });
export const taskIdParam = z.object({ taskId: z.string() });
export const contactTaskParam = z.object({
  id: z.string(),
  taskId: z.string(),
});
export const externalIdParam = z.object({
  workspaceId: z.string(),
  externalId: z.string().min(1).max(200),
});
export const poolSlugParam = z.object({
  workspaceId: z.string(),
  slug: z.string().min(1).max(100),
});
export const poolMemberParam = z.object({
  poolId: z.string(),
  contactId: z.string(),
});
export const poolExternalParam = z.object({
  poolId: z.string(),
  externalId: z.string().min(1).max(200),
});

const searchQuery = z.string().optional().openapi({
  description: "Search name, phone, email and external id (case-insensitive).",
});

export const listContactsQuery = z.object({
  q: searchQuery,
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

export const createContactBody = z.object(coreFields);

export const upsertContactBody = z.object({
  ...coreFields,
  name: coreFields.name.optional().openapi({
    description: "Required when the contact does not exist yet.",
  }),
});

export const updateContactBody = z.object({
  name: coreFields.name.optional(),
  phone: coreFields.phone,
  email: coreFields.email,
  externalId: coreFields.externalId,
  source: coreFields.source,
});

export const linkTaskBody = z.object({ taskId: z.string() });

// ---- pools ---------------------------------------------------------------------

const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, numbers and dashes",
  });

export const createPoolBody = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slug.optional().openapi({
    description:
      "Stable handle for integrations; derived from the name if omitted.",
  }),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(100).nullable().optional(),
});

export const updatePoolBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: slug.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(100).nullable().optional(),
  position: z.number().int().optional(),
});

export const createFieldBody = z.object({
  name: z.string().trim().min(1).max(200),
  type: poolFieldType,
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

export const setMemberValuesBody = z.object({
  values: z.record(z.string(), fieldValueInput).optional().openapi({
    description: "Pool field values by field name (case-insensitive).",
  }),
  createMissing: z.boolean().optional().default(false).openapi({
    description: "Create pool fields that do not exist yet.",
  }),
  types: z.record(z.string(), poolFieldType).optional().openapi({
    description:
      "Type for fields created by createMissing. Defaults: number for numbers, boolean for booleans, text otherwise. dropdown/multiselect must be defined first.",
  }),
});

// ---- filters and bulk ------------------------------------------------------------

export const filterCondition = z.object({
  field: z.string().min(1).openapi({
    description:
      'A contact property (name, phone, email, externalId, source, createdAt, updatedAt), "field:<fieldId>" for a field of the pool being queried, "pools" for pool membership (contacts only; values are pool ids), or "board:<projectId>" for the contact\'s linked task on that board (values are column ids).',
  }),
  op: z.enum(FILTER_OPERATORS),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .nullable()
    .optional(),
});

export const contactFilter = z
  .object({
    match: z.enum(["all", "any"]).optional().default("all"),
    conditions: z.array(filterCondition).max(20),
  })
  .openapi("ContactFilter");

export const queryBody = z.object({
  q: searchQuery,
  filter: contactFilter.optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const contactIds = z.array(z.string().min(1)).min(1).max(500);

export const bulkIdsBody = z.object({ ids: contactIds });

export const bulkUpdateContactsBody = z.object({
  ids: contactIds,
  source: z.string().trim().max(200).nullable(),
});

export const bulkMemberValuesBody = z.object({
  ids: contactIds,
  values: z.record(z.string(), fieldValueInput).openapi({
    description:
      "Pool field values by field name (case-insensitive), set on every listed member; null clears.",
  }),
});

export const memberTaskParam = z.object({
  poolId: z.string(),
  contactId: z.string(),
  taskId: z.string(),
});

export const addToBoardBody = z.object({
  ids: contactIds,
  projectId: z.string().min(1),
  columnId: z.string().min(1).optional().openapi({
    description: "Stage to start in; the board's first stage if omitted.",
  }),
});
