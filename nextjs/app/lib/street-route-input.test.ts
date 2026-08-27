import { describe, expect, it } from "vitest";

import {
  validateBoundingBox,
  validateBufferInFeet,
  validateCrossStreetPair,
  validateDateRange,
  validateStreetName,
} from "./street-route-input";

const expectError = async (result: { error?: Response }, message: string) => {
  expect(result.error?.status).toBe(400);
  await expect(result.error?.json()).resolves.toEqual({ error: message });
};

describe("street route input validation", () => {
  it("accepts and normalizes valid street names and cross-street pairs", () => {
    expect(
      validateStreetName("  N O'Neil ST  ", "fullStreetName", true),
    ).toEqual({ value: "N O'Neil ST" });
    expect(validateCrossStreetPair(" E 1ST AVE ", "E 2ND AVE")).toEqual({
      value: ["E 1ST AVE", "E 2ND AVE"],
    });
  });

  it("rejects missing, partial, blank, overlong, and control-character street inputs", async () => {
    await expectError(
      validateStreetName(null, "fullStreetName", true),
      "fullStreetName is required",
    );
    await expectError(
      validateCrossStreetPair("E 1ST AVE", null),
      "crossStreet1 and crossStreet2 must be provided together",
    );
    await expectError(
      validateStreetName("   ", "fullStreetName", true),
      "fullStreetName must be a non-empty street name no longer than 200 characters",
    );
    await expectError(
      validateStreetName("A".repeat(201), "fullStreetName", true),
      "fullStreetName must be a non-empty street name no longer than 200 characters",
    );
    await expectError(
      validateStreetName("N MAIN\nST", "fullStreetName", true),
      "fullStreetName must be a non-empty street name no longer than 200 characters",
    );
  });

  it("accepts finite buffers within one mile, including decimals and zero", () => {
    expect(validateBufferInFeet("0")).toEqual({ value: 0 });
    expect(validateBufferInFeet(" 12.5 ")).toEqual({ value: 12.5 });
    expect(validateBufferInFeet("5280")).toEqual({ value: 5280 });
  });

  it.each(["", "-1", "12 feet", "NaN", "Infinity", "5280.1"])(
    "rejects the invalid buffer %j",
    async (buffer) => {
      await expectError(
        validateBufferInFeet(buffer),
        "bufferInFeet must be a number between 0 and 5280",
      );
    },
  );

  it("validates real calendar dates and range ordering", async () => {
    expect(validateDateRange("2024-02-29", "2024-03-01")).toEqual({
      value: { startDate: "2024-02-29", endDate: "2024-03-01" },
    });

    await expectError(
      validateDateRange("2025-02-29", null),
      "startDate must be a valid date in YYYY-MM-DD format",
    );
    await expectError(
      validateDateRange("2025-03-02", "2025-03-01"),
      "startDate must be on or before endDate",
    );
  });

  it("validates bounding-box shape, coordinate ranges, and ordering", async () => {
    expect(validateBoundingBox("-105,39,-104,40")).toEqual({
      value: [-105, 39, -104, 40],
    });

    await expectError(
      validateBoundingBox("-105,39,-104"),
      "bbox must contain minLongitude,minLatitude,maxLongitude,maxLatitude",
    );
    await expectError(
      validateBoundingBox("-104,40,-105,39"),
      "bbox must contain valid longitude/latitude bounds in ascending order",
    );
  });
});
