import { describe, expect, it } from "vitest";
import { hasBookingWords, isAgencyDomain, senderDomain, shouldProcess } from "./filter";

const domains = ["northagency.com", "select.co"];

describe("senderDomain", () => {
  it("parses display-name addresses", () => {
    expect(senderDomain("Jo Booker <jo@NorthAgency.com>")).toBe("northagency.com");
    expect(senderDomain("jo@select.co")).toBe("select.co");
    expect(senderDomain("nobody")).toBeNull();
  });
});

describe("isAgencyDomain", () => {
  it("matches exact and subdomains", () => {
    expect(isAgencyDomain("a@northagency.com", domains)).toBe(true);
    expect(isAgencyDomain("a@bookings.northagency.com", domains)).toBe(true);
    expect(isAgencyDomain("a@northagency.com.evil.io", domains)).toBe(false);
    expect(isAgencyDomain("a@gmail.com", domains)).toBe(false);
  });
});

describe("hasBookingWords", () => {
  it.each([
    ["CONFIRMED: Northbound Mon 27 Oct", true],
    ["2nd option – Studio Halden 3 Nov", true],
    ["Call sheet attached", true],
    ["Callsheet – Day 2", true],
    ["Your flight itinerary", true],
    ["Remittance advice", true],
    ["Lunch?", false],
    ["Your Amazon order has shipped", false],
    ["optional extras for your plan", false],
  ])("%s → %s", (subject, expected) => {
    expect(hasBookingWords(subject)).toBe(expected);
  });
});

describe("shouldProcess", () => {
  it("keeps agency mail regardless of subject", () => {
    expect(shouldProcess({ from: "x@select.co", subject: "hi" }, domains)).toEqual({ keep: true, reason: "agency" });
  });
  it("keeps booking subjects from anyone", () => {
    expect(shouldProcess({ from: "x@gmail.com", subject: "Booking confirmed" }, domains)).toEqual({
      keep: true,
      reason: "subject",
    });
  });
  it("drops the rest", () => {
    expect(shouldProcess({ from: "x@gmail.com", subject: "hi" }, domains).keep).toBe(false);
  });
});
