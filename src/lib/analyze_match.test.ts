import { describe, it, expect, vi } from "vitest";
import { analyzeMatch } from "./analyze_match";

vi.mock("./get_match_by_id", () => ({
  getMatchById: vi.fn(),
}));

const { getMatchById } = await import("./get_match_by_id");

describe("analyzeMatch", () => {
  it("returns NOT_FOUND for non-existent match id", async () => {
    vi.mocked(getMatchById).mockReturnValue({ ok: false, error: "NOT_FOUND" });
    const result = await analyzeMatch(999_999);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns API_KEY_MISSING when GEMINI_API_KEY is not set and match exists", async () => {
    vi.mocked(getMatchById).mockReturnValue({
      ok: true,
      data: {
        id: 1,
        title: "Test",
        videoPath: "test.mp4",
        videoSource: "local",
        durationSeconds: null,
        date: null,
        result: null,
        notes: null,
        myDescription: null,
        opponentDescription: null,
        tags: null,
        category: "Uncategorized",
        wonByMe: null,
        partnerStatus: "none",
        opponents: [],
        partner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const saved = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      const result = await analyzeMatch(1);
      expect(result).toEqual({ ok: false, error: "API_KEY_MISSING" });
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
      else delete process.env.GEMINI_API_KEY;
    }
  });
});
