import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import { getConversationById, addMessage, deleteMessagesAfter, updateMessageContent } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await context.params;
    const conversation = getConversationById(id, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const { role, content, attachments, model, deleteAfterMessageId } = body;

    if (!role || !content) {
      return NextResponse.json({ error: "Role and content are required" }, { status: 400 });
    }

    // If deleteAfterMessageId is specified (e.g. user is editing/regenerating from an earlier message)
    if (deleteAfterMessageId) {
      const targetMessage = conversation.messages.find((m) => m.id === deleteAfterMessageId);
      if (targetMessage) {
        deleteMessagesAfter(id, user.id, targetMessage.created_at);
      }
    }

    const newMessage = addMessage({
      conversation_id: id,
      user_id: user.id,
      role,
      content,
      attachments_json: attachments ? JSON.stringify(attachments) : undefined,
      model,
    });

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (error) {
    console.error("[api/conversations/:id/messages POST] Error:", error);
    return NextResponse.json({ error: "Failed to add message" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await context.params;
    const conversation = getConversationById(id, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const { messageId, content } = body;

    if (!messageId || !content) {
      return NextResponse.json({ error: "messageId and content are required" }, { status: 400 });
    }

    const updated = updateMessageContent(messageId, user.id, content);
    return NextResponse.json({ message: updated });
  } catch (error) {
    console.error("[api/conversations/:id/messages PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
