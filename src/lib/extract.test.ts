import { describe, expect, it } from "vitest";
import { type Extraction, normalise, reviewReasons, validDate, validInstant, validTime, validZone } from "./extract";

const base: Extraction = {
  job: {
    client: "Northbound",
    agency: "North",
    booker: "Jo",
    job_type: "e-commerce",
    status: "confirmed",
    start_date: "2026-10-27",
    end_date: null,
    call_time: "7:00",
    wrap_time: "18.30",
    location: "Studio Halden, London",
    timezone: "Europe/London",
    day_rate: 1200,
    currency: "gbp",
    usage: null,
    notes: null,
  },
  travel: [{ kind: "flight", from: "LHR", to: "JFK", depart_at: "2026-10-26T07:15:00+01:00", arrive_at: "not a time", reference: "ABC123" }],
  payment: null,
  changes: [],
  confidence: 0.9,
  uncertain_fields: [],
};

describe("validators", () => {
  it("dates", () => {
    expect(validDate("2026-02-30")).toBeNull();
    expect(validDate("2026-10-27")).toBe("2026-10-27");
    expect(validDate("27/10/2026")).toBeNull();
  });
  it("times", () => {
    expect(validTime("7:00")).toBe("07:00");
    expect(validTime("18.30")).toBe("18:30");
    expect(validTime("25:00")).toBeNull();
    expect(validTime("7am")).toBeNull();
  });
  it("instants and zones", () => {
    expect(validInstant("2026-10-26T07:15:00+01:00")).toBe("2026-10-26T06:15:00.000Z");
    expect(validZone("Europe/London")).toBe("Europe/London");
    expect(validZone("London")).toBeNull();
  });
});

describe("normalise", () => {
  it("fills end_date, pads times, upper-cases currency", () => {
    const n = normalise(base);
    expect(n.job?.end_date).toBe("2026-10-27");
    expect(n.job?.call_time).toBe("07:00");
    expect(n.job?.wrap_time).toBe("18:30");
    expect(n.job?.currency).toBe("GBP");
    expect(n.uncertain_fields).toEqual(["travel[0].arrive_at"]);
    expect(n.travel[0].arrive_at).toBeNull();
  });

  it("flags a bad date as uncertain rather than keeping it", () => {
    const n = normalise({ ...base, job: { ...base.job!, start_date: "Monday" } });
    expect(n.job?.start_date).toBeNull();
    expect(n.uncertain_fields).toContain("start_date");
  });

  it("repairs an end before start", () => {
    const n = normalise({ ...base, job: { ...base.job!, end_date: "2026-10-20" } });
    expect(n.job?.end_date).toBe("2026-10-27");
    expect(n.uncertain_fields).toContain("end_date");
  });
});

describe("reviewReasons", () => {
  it("is empty for a complete, confident job", () => {
    expect(reviewReasons(normalise({ ...base, travel: [] }))).toEqual([]);
  });
  it("lists missing required fields and low confidence", () => {
    const r = reviewReasons(normalise({ ...base, travel: [], confidence: 0.4, job: { ...base.job!, day_rate: null, location: null } }));
    expect(r).toEqual(["low confidence (0.40)", "location missing", "day_rate missing"]);
  });
});
