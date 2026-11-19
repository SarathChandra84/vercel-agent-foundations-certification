import { adminChatFlow } from "@/lib/workflows/admin-chat-flow";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/admin-auth";
import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { start } from "workflow/api";

export async function POST(req: Request) {
  // proxy.ts only guards /admin/* pages, not this API route, so check the admin cookie here.
  const cookieStore = await cookies();
  if (cookieStore.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const today = new Date().toISOString().slice(0, 10);
  const run = await start(adminChatFlow, [messages, today]);
  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
