import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, generateKey } from "./crypto";

describe("crypto", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = generateKey();
  });

  it("round-trips", () => {
    const blob = encrypt("1//0g-refresh-token");
    expect(blob).not.toContain("refresh");
    expect(decrypt(blob)).toBe("1//0g-refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a tampered blob", () => {
    const blob = encrypt("secret");
    const buf = Buffer.from(blob, "base64url");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decrypt(buf.toString("base64url"))).toThrow();
  });

  it("rejects a wrong key", () => {
    const blob = encrypt("secret");
    process.env.TOKEN_ENCRYPTION_KEY = generateKey();
    expect(() => decrypt(blob)).toThrow();
  });

  it("rejects a short key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});
