import { describe, expect, it } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import type { ContactRow } from "./contact-row";
import { contactsToCsv } from "./export-contacts-csv";

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

const contact = (overrides: Partial<ContactRow>): ContactRow => ({
  id: "c1",
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

describe("contactsToCsv", () => {
  it("writes a header, quotes commas and joins multiselect values", () => {
    const csv = contactsToCsv(
      [
        contact({
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

  it("lists pools when asked", () => {
    const csv = contactsToCsv(
      [
        contact({
          pools: [
            { id: "p1", name: "Nurse pool", slug: "nurse" },
            { id: "p2", name: "Doctor pool", slug: "doctor" },
          ],
        }),
      ],
      [],
      { ...headers, pools: "Pools" },
    );
    const [head, row] = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(head?.endsWith(",Updated,Pools")).toBe(true);
    expect(row?.endsWith(",Nurse pool; Doctor pool")).toBe(true);
  });

  it("neutralises formulas but keeps phone numbers and negative numbers", () => {
    const csv = contactsToCsv(
      [contact({ name: "=HYPERLINK(1)", source: "+cmd|x", phone: "-12" })],
      [],
      headers,
    );
    const row = csv.split("\r\n")[1];
    expect(row).toBe(
      "'=HYPERLINK(1),-12,,,'+cmd|x,2026-10-01T00:00:00.000Z,2026-10-02T00:00:00.000Z",
    );
  });
});
