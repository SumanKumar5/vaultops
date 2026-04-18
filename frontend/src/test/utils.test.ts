import { describe, it, expect } from "vitest";
import { cn, timeAgo, isExpired, isExpiringSoon } from "../lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns empty string for all falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});

describe("isExpired", () => {
  it("returns false for null", () => {
    expect(isExpired(null)).toBe(false);
  });

  it("returns true for past date", () => {
    expect(isExpired("2020-01-01T00:00:00Z")).toBe(true);
  });

  it("returns false for future date", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});

describe("isExpiringSoon", () => {
  it("returns false for null", () => {
    expect(isExpiringSoon(null)).toBe(false);
  });

  it("returns false for already expired", () => {
    expect(isExpiringSoon("2020-01-01T00:00:00Z")).toBe(false);
  });

  it("returns true for expiry within 7 days", () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(soon)).toBe(true);
  });

  it("returns false for expiry beyond 7 days", () => {
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(far)).toBe(false);
  });
});

describe("timeAgo", () => {
  it("returns just now for recent time", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("returns minutes for recent past", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours for older past", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days for old past", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });
});
