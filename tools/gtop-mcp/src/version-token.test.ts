import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  timestampFromUpdateToken,
  updateTokenFromTimestamp,
} from "./version-token.js";

describe("Firestore update tokens", () => {
  it("round-trips seconds and nanoseconds without Date precision loss", () => {
    const original = new Timestamp(1_721_980_000, 123_456_789);
    const token = updateTokenFromTimestamp(original);
    const reconstructed = timestampFromUpdateToken(token);

    expect(token).toBe("1721980000:123456789");
    expect(reconstructed.isEqual(original)).toBe(true);
  });

  it("rejects malformed and out-of-range tokens", () => {
    expect(() => timestampFromUpdateToken("063857576800.123456789")).toThrow(
      "Invalid Firestore update token.",
    );
    expect(() => timestampFromUpdateToken("1721980000:1000000000")).toThrow(
      "Invalid Firestore update token.",
    );
  });
});
