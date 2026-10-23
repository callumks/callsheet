import { describe, expect, it } from "vitest";
import { bodyText, htmlToText } from "./gmail";

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("bodyText", () => {
  it("prefers text/plain in a multipart message", () => {
    const text = bodyText({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("Call 07:00\r\n\r\n\r\nLocation: Studio") } },
        { mimeType: "text/html", body: { data: b64("<p>Call <b>07:00</b></p>") } },
      ],
    });
    expect(text).toBe("Call 07:00\n\nLocation: Studio");
  });

  it("falls back to stripped html", () => {
    const text = bodyText({
      mimeType: "text/html",
      body: { data: b64("<div>Hi<br>Rate &amp; usage: &pound;1,200</div><style>x{}</style>") },
    });
    expect(text).toBe("Hi\nRate & usage: &pound;1,200");
  });

  it("handles nested parts", () => {
    const text = bodyText({
      mimeType: "multipart/mixed",
      parts: [{ mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64("deep") } }] }],
    });
    expect(text).toBe("deep");
  });
});

describe("htmlToText", () => {
  it("turns block ends into newlines", () => {
    expect(htmlToText("<p>a</p><p>b</p>")).toBe("a\nb\n");
  });
});
