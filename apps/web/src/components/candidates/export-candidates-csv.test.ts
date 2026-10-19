import { describe, expect, it } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import type { Candidate } from "@/fetchers/candidate/types";
import { candidatesToCsv } from "./export-candidates-csv";

const field = (
  id: string,
  name: string,
  type: CustomFieldDefinition["type"],
): CustomFieldDefinition => ({
  id,
  projectId: "",
  name,
  type,
  required: false,
  defaultValue: null,
  options: null,
  position: 0,
  createdAt: "",
  updatedAt: "",
});

const candidate = (overrides: Partial<Candidate>): Candidate => ({
  id: "c1",
  workspaceId: "w",
  name: "Asha",
  phone: null,
  email: null,
  externalId: null,
  source: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  fields: {},
  ...overrides,
});

const headers = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  externalId: "External ID",
  source: "Source",
  createdAt: "Added",
  updatedAt: "Updated",
};

describe("candidatesToCsv", () => {
  it("writes a header, quotes commas and joins multiselect values", () => {
    const csv = candidatesToCsv(
      [
        candidate({
          name: 'Asha "AK", RN',
          phone: "+91 98765 43210",
          fields: { skills: '["BLS","ACLS"]', exp: "5" },
        }),
      ],
      [
        field("skills", "Skills", "multiselect"),
        field("exp", "Experience", "number"),
      ],
      headers,
    );
    const [head, row] = csv.replace(/^﻿/, "").split("\r\n");
    expect(head).toBe(
      "Name,Phone,Email,External ID,Source,Added,Updated,Skills,Experience",
    );
    expect(row).toBe(
      '"Asha ""AK"", RN",+91 98765 43210,,,,2026-10-01T00:00:00.000Z,2026-10-02T00:00:00.000Z,BLS; ACLS,5',
    );
  });

  it("neutralises formulas but keeps phone numbers and negative numbers", () => {
    const csv = candidatesToCsv(
      [candidate({ name: "=HYPERLINK(1)", source: "+cmd|x", phone: "-12" })],
      [],
      headers,
    );
    const row = csv.split("\r\n")[1];
    expect(row).toBe(
      "'=HYPERLINK(1),-12,,,'+cmd|x,2026-10-01T00:00:00.000Z,2026-10-02T00:00:00.000Z",
    );
  });
});
