import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import { getConversationById, updateConversation, deleteConversation } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await context.params;
    const conversation = getConversationById(id, user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[api/conversations/:id GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await context.params;
    const body = await request.json();

    const updated = updateConversation(id, user.id, {
      title: body.title,
      pinned: body.pinned,
      archived: body.archived,
      project_id: body.project_id,
    });

    if (!updated) {
      return NextResponse.json({ error: "Conversation not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("[api/conversations/:id PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await context.params;
    deleteConversation(id, user.id);

    return NextResponse.json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    console.error("[api/conversations/:id DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
