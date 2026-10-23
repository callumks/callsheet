// Gmail REST over fetch, read-only. Bodies are fetched on demand and
// returned to the caller; nothing here writes them anywhere.

import { decrypt } from "./crypto";
import { refreshAccessToken } from "./google-oauth";
import type { GoogleAccount } from "@/db/schema";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type MessageMeta = {
  gmailId: string;
  threadId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  snippet: string;
};

export type MessageBody = MessageMeta & { text: string };

// One access token per process, refreshed a minute before it expires.
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export async function accessTokenFor(account: GoogleAccount): Promise<string> {
  const cached = tokenCache.get(account.email);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken;
  const fresh = await refreshAccessToken(decrypt(account.refreshTokenEnc));
  tokenCache.set(account.email, fresh);
  return fresh.accessToken;
}

export class GmailError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gmail<T>(token: string, path: string, params?: Record<string, string | string[]>): Promise<T> {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) u.searchParams.append(k, item);
  }
  const res = await fetch(u, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new GmailError(res.status, `Gmail ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * New inbox message ids since `lastHistoryId`. Falls back to a recent-window
 * list when there is no history id or Gmail has expired it (404).
 */
export async function listNewMessageIds(
  token: string,
  lastHistoryId: string | null,
  opts: { fallbackDays?: number } = {},
): Promise<{ ids: string[]; historyId: string }> {
  const fallbackDays = opts.fallbackDays ?? 7;

  if (lastHistoryId) {
    try {
      const ids = new Set<string>();
      let pageToken: string | undefined;
      let latest = lastHistoryId;
      do {
        type Page = {
          history?: { id: string; messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[];
          nextPageToken?: string;
          historyId: string;
        };
        const page = await gmail<Page>(token, "history", {
          startHistoryId: lastHistoryId,
          historyTypes: "messageAdded",
          labelId: "INBOX",
          ...(pageToken ? { pageToken } : {}),
        });
        for (const h of page.history ?? []) {
          for (const m of h.messagesAdded ?? []) ids.add(m.message.id);
        }
        latest = page.historyId ?? latest;
        pageToken = page.nextPageToken;
      } while (pageToken);
      return { ids: [...ids], historyId: latest };
    } catch (e) {
      if (!(e instanceof GmailError && e.status === 404)) throw e;
      // History expired; fall through to the window list.
    }
  }

  const profile = await gmail<{ historyId: string }>(token, "profile");
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    type Page = { messages?: { id: string }[]; nextPageToken?: string };
    const page = await gmail<Page>(token, "messages", {
      q: `newer_than:${fallbackDays}d in:inbox`,
      maxResults: "100",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const m of page.messages ?? []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { ids, historyId: profile.historyId };
}

type Part = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: Part[];
  headers?: { name: string; value: string }[];
};

type Message = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: Part;
};

function header(m: Message, name: string): string {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function toMeta(m: Message): MessageMeta {
  return {
    gmailId: m.id,
    threadId: m.threadId,
    from: header(m, "From"),
    subject: header(m, "Subject"),
    receivedAt: new Date(Number(m.internalDate ?? Date.now())),
    snippet: m.snippet ?? "",
  };
}

/** Headers only. This is as far as the filter step ever reads. */
export async function getMessageMeta(token: string, id: string): Promise<MessageMeta> {
  const m = await gmail<Message>(token, `messages/${id}`, {
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"],
  });
  return toMeta(m);
}

/** Full body as plain text, for the classify and extract steps only. */
export async function getMessageBody(token: string, id: string): Promise<MessageBody> {
  const m = await gmail<Message>(token, `messages/${id}`, { format: "full" });
  return { ...toMeta(m), text: bodyText(m.payload) };
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function bodyText(payload: Part | undefined): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: Part) => {
    if (p.parts?.length) p.parts.forEach(walk);
    const data = p.body?.data;
    if (!data) return;
    if (p.mimeType === "text/plain") plain.push(decodeBase64Url(data));
    else if (p.mimeType === "text/html") html.push(decodeBase64Url(data));
  };
  walk(payload);
  const text = plain.length ? plain.join("\n") : html.map(htmlToText).join("\n");
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** A link to the message in the Gmail web UI. */
export function gmailUrl(gmailId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${gmailId}`;
}
