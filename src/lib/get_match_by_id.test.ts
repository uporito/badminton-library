import { describe, it, expect } from "vitest";
import { getMatchById } from "./get_match_by_id";

describe("getMatchById", () => {
  it("returns NOT_FOUND for non-existent id", () => {
    const result = getMatchById(999_999);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for zero id", () => {
    const result = getMatchById(0);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for negative id", () => {
    const result = getMatchById(-1);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
