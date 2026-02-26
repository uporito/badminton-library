import { describe, it, expect } from "vitest";
import { formatDuration } from "./format_duration";

describe("formatDuration", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3600)).toBe("60:00");
    expect(formatDuration(90)).toBe("1:30");
  });

  it("returns — for null or undefined", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
  });

  it("returns — for invalid values", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
  });
});
