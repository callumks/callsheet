import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { runTool, toolDefinitions, toolSchemas, type ToolName } from "@/lib/agent-tools";

export const dynamic = "force-dynamic";

// Signed-in session (via proxy) or, for an external agent runtime,
// `Authorization: Bearer $AGENT_TOKEN`. The proxy lets the bearer through.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/tools/[name]">) {
  const { name } = await ctx.params;
  if (name === "definitions") return NextResponse.json(toolDefinitions);
  return NextResponse.json({ error: "POST a JSON body of arguments" }, { status: 405 });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/tools/[name]">) {
  const { name } = await ctx.params;
  if (!(name in toolSchemas)) return NextResponse.json({ error: `unknown tool ${name}` }, { status: 404 });
  const args = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await runTool(name as ToolName, args));
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "bad arguments", issues: e.issues }, { status: 400 });
    throw e;
  }
}
