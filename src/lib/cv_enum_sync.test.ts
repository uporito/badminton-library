import { describe, it, expect } from "vitest";
import {
  shotTypeEnum,
  zoneEnum,
  outcomeEnum,
  shotPlayerEnum,
  sideEnum,
} from "@/db/schema";

// These must match the Python models.py enums exactly
const PYTHON_SHOT_TYPES = ["serve", "clear", "smash", "drop", "drive", "lift", "net", "block"];
const PYTHON_ZONES = [
  "left_front", "left_mid", "left_back",
  "center_front", "center_mid", "center_back",
  "right_front", "right_mid", "right_back",
];
const PYTHON_OUTCOMES = ["winner", "error", "neither"];
const PYTHON_SHOT_PLAYERS = ["me", "partner", "opponent"];
const PYTHON_SIDES = ["me", "opponent"];

describe("CV enum sync with Python models", () => {
  it("shot types match", () => {
    expect([...shotTypeEnum].sort()).toEqual([...PYTHON_SHOT_TYPES].sort());
  });
  it("zones match", () => {
    expect([...zoneEnum].sort()).toEqual([...PYTHON_ZONES].sort());
  });
  it("outcomes match", () => {
    expect([...outcomeEnum].sort()).toEqual([...PYTHON_OUTCOMES].sort());
  });
  it("shot players match", () => {
    expect([...shotPlayerEnum].sort()).toEqual([...PYTHON_SHOT_PLAYERS].sort());
  });
  it("sides match", () => {
    expect([...sideEnum].sort()).toEqual([...PYTHON_SIDES].sort());
  });
});