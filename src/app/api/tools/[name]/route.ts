import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runTool, toolDefinitions, toolSchemas, type ToolName } from "@/lib/agent-tools";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Signed-in session (via proxy) or, for an external agent runtime,
// `Authorization: Bearer $AGENT_TOKEN`. The proxy lets the bearer through;
// it acts for AGENT_EMAIL.
async function caller(): Promise<string | null> {
  const session = await getSession();
  if (session) return session.userId;
  const email = (process.env.AGENT_EMAIL ?? process.env.ALLOWED_EMAIL)?.trim().toLowerCase();
  if (!email) return null;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return user?.id ?? null;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/tools/[name]">) {
  const { name } = await ctx.params;
  if (name === "definitions") return NextResponse.json(toolDefinitions);
  return NextResponse.json({ error: "POST a JSON body of arguments" }, { status: 405 });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/tools/[name]">) {
  const { name } = await ctx.params;
  if (!(name in toolSchemas)) return NextResponse.json({ error: `unknown tool ${name}` }, { status: 404 });
  const userId = await caller();
  if (!userId) return NextResponse.json({ error: "no user for this agent: set AGENT_EMAIL" }, { status: 403 });
  const args = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await runTool(name as ToolName, args, { userId }));
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "bad arguments", issues: e.issues }, { status: 400 });
    throw e;
  }
}
