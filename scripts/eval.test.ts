import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR, Scorer, fieldMatches, loadFixtures, parseFixture } from "./eval";

describe("fixtures", () => {
  const set = loadFixtures();

  it("has a .txt and .expected.json for every fixture", () => {
    const files = readdirSync(FIXTURES_DIR);
    const txt = files.filter((f) => f.endsWith(".txt")).length;
    const json = files.filter((f) => f.endsWith(".expected.json")).length;
    expect(txt).toBe(json);
    expect(txt).toBeGreaterThanOrEqual(20);
    expect(set.length).toBe(txt);
  });

  it("parses headers and keeps the body", () => {
    for (const { fixture } of set) {
      expect(fixture.from).toMatch(/@/);
      expect(fixture.subject.length).toBeGreaterThan(0);
      expect(fixture.threadId).toMatch(/^t-\d{3}$/);
      expect(fixture.text.length).toBeGreaterThan(20);
    }
  });

  it("expected extractions are already normalised", () => {
    for (const { fixture, expected } of set) {
      const x = expected.extraction;
      if (!x) {
        expect(expected.label).toBe("irrelevant");
        continue;
      }
      if (x.job) {
        for (const d of [x.job.start_date, x.job.end_date]) if (d) expect(d, fixture.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const t of [x.job.call_time, x.job.wrap_time]) if (t) expect(t, fixture.name).toMatch(/^\d{2}:\d{2}$/);
        if (x.job.currency) expect(x.job.currency, fixture.name).toMatch(/^[A-Z]{3}$/);
      }
      for (const t of x.travel) {
        for (const i of [t.depart_at, t.arrive_at]) if (i) expect(i, fixture.name).toMatch(/Z$/);
      }
    }
  });

  it("covers every label", () => {
    const labels = new Set(set.map((s) => s.expected.label));
    expect([...labels].sort()).toEqual(["expense", "irrelevant", "new_booking", "payment", "travel", "update"]);
  });
});

describe("parseFixture", () => {
  it("rejects a missing header", () => {
    expect(() => parseFixture("From: a@b.c\nSubject: x\nDate: 2026-01-01T00:00:00Z\n\nbody", "bad")).toThrow(/thread/);
  });
  it("rejects a missing blank line", () => {
    expect(() => parseFixture("From: a@b.c\nSubject: x", "bad")).toThrow(/blank line/);
  });
});

describe("scoring", () => {
  it("matches exact fields strictly and text fields loosely", () => {
    expect(fieldMatches("call_time", "07:00", "07:00")).toBe(true);
    expect(fieldMatches("call_time", "07:00", "7:00")).toBe(false);
    expect(fieldMatches("location", "Studio Halden, 14 Arch Street, London E2", "Studio Halden, 14 Arch St, London E2")).toBe(false);
    expect(fieldMatches("location", "Studio Halden, 14 Arch Street, London E2", "Studio Halden, 14 Arch Street, London E2.")).toBe(true);
    expect(fieldMatches("notes", "Bring nude underwear and clean white trainers.", "Bring nude underwear and clean white trainers. Call sheet Friday.")).toBe(true);
    expect(fieldMatches("day_rate", 1200, 1200.001)).toBe(true);
    expect(fieldMatches("day_rate", null, 1200)).toBe(false);
    expect(fieldMatches("day_rate", null, null)).toBe(true);
  });

  it("flags a run with bad required fields", () => {
    const s = new Scorer();
    const { expected } = loadFixtures(FIXTURES_DIR, "001")[0];
    const x = expected.extraction!;
    s.label("001", "new_booking", "new_booking");
    s.extraction("001", x, { ...x, job: { ...x.job!, day_rate: null } });
    expect(s.failed()).toEqual(["job.day_rate accuracy 0.00 < 0.90"]);
    expect(s.mismatches).toEqual([{ id: "001", field: "job.day_rate", expected: 1200, got: null }]);
  });
});
