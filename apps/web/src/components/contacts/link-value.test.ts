import { describe, expect, it } from "vite-plus/test";
import { linkValue } from "./link-value";

describe("linkValue", () => {
  it("labels a URL by its file name, else its host", () => {
    expect(
      linkValue(" https://forms.findingnemooh.com/files/ws/Asha%20K%20CV.pdf "),
    ).toEqual({
      href: "https://forms.findingnemooh.com/files/ws/Asha%20K%20CV.pdf",
      label: "Asha K CV.pdf",
    });
    expect(linkValue("http://example.com")?.label).toBe("example.com");
  });

  it("ignores plain text, other schemes and text with spaces", () => {
    expect(linkValue("Pune")).toBeNull();
    expect(linkValue("example.com/cv.pdf")).toBeNull();
    expect(linkValue("javascript:alert(1)")).toBeNull();
    expect(linkValue("https://a.com/x see this")).toBeNull();
    expect(linkValue(null)).toBeNull();
  });
});
