import { parseMultiselect } from "@/components/custom-fields/parse-multiselect";
import type {
  CustomFieldDefinition,
  CustomFieldType,
} from "@/components/project/custom-fields/types";
import type { CandidateValueInput } from "@/fetchers/candidate/set-candidate-values";
import type { CandidateField } from "@/fetchers/candidate/types";

const FIELD_TYPES: CustomFieldType[] = [
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
];

function toFieldType(type: string): CustomFieldType {
  return FIELD_TYPES.includes(type as CustomFieldType)
    ? (type as CustomFieldType)
    : "text";
}

/** Candidate fields share the task custom-field shape minus the project. */
export function toCustomFieldDefinition(
  field: CandidateField,
): CustomFieldDefinition {
  return {
    ...field,
    type: toFieldType(field.type),
    projectId: "",
    createdAt: "",
    updatedAt: "",
  };
}

/** A synthetic text field so core properties reuse the same row editor. */
export function textField(
  id: string,
  name: string,
  required = false,
): CustomFieldDefinition {
  return {
    id,
    projectId: "",
    name,
    type: "text",
    required,
    defaultValue: null,
    options: null,
    position: 0,
    createdAt: "",
    updatedAt: "",
  };
}

/** Editor output (a stored string) to the values API input. */
export function toValueInput(
  field: CustomFieldDefinition,
  value: string,
): CandidateValueInput {
  if (field.type === "multiselect") {
    const values = parseMultiselect(value);
    return values.length > 0 ? values : null;
  }
  return value.trim() === "" ? null : value;
}
