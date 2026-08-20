import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import { listConversations, createConversation, touchConversation } from "@/lib/db";
import { cleanAndFormatTitle } from "@/lib/title-generator";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    const rawConversations = listConversations(user.id, search, projectId);

    // Clean up any legacy raw/messy titles dynamically
    const conversations = rawConversations.map((c) => {
      let cleanTitle = c.title;
      if (cleanTitle === "New Chat") {
        cleanTitle = "New Conversation";
      } else if (cleanTitle.length > 30 || /^(write|help|explain|what\s+is|build)\b/i.test(cleanTitle) || /["'`*#]/.test(cleanTitle)) {
        cleanTitle = cleanAndFormatTitle(cleanTitle);
      }
      return {
        ...c,
        title: cleanTitle,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[api/conversations GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const rawTitle = (body && typeof body.title === "string" && body.title.trim()) || "New Conversation";
    const title = cleanAndFormatTitle(rawTitle);
    const projectId = (body && typeof body.projectId === "string" && body.projectId.trim()) || "general";

    const conversation = createConversation(user.id, title, projectId);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("[api/conversations POST] Error:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
