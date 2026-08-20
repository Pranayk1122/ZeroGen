import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import {
  verifyConversation,
  getRecentMessageHistory,
  addMessage,
  touchConversation,
  updateUserSettings,
} from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { createChatStream, formatAIError, MessagePayload } from "@/lib/ai";
import { generateConversationTitle } from "@/lib/title-generator";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse("You must be logged in to send messages.");
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON request body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      conversationId,
      message,
      model,
      persona,
      mode,
      taskMode,
      systemPrompt: customSystemPrompt,
      useMemory,
      memory,
      attachments,
      isRetry,
    } = body;

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fast indexed ownership check (<0.1ms)
    const conversation = verifyConversation(conversationId, user.id);
    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found or unauthorized." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messageText = (message || "").trim();
    if (!messageText && !isRetry && !attachments?.length) {
      return new Response(JSON.stringify({ error: "Message or attachment is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load lean message history (<0.1ms)
    const history: MessagePayload[] = getRecentMessageHistory(conversationId, user.id, 8);

    // If new user message, persist and append to context
    if (messageText && !isRetry) {
      addMessage({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: messageText,
        attachments_json: attachments?.length ? JSON.stringify(attachments) : undefined,
        model,
      });
      history.push({ role: "user", content: messageText });
    }

    // Build system prompt (<0.1ms)
    const systemPrompt = buildSystemPrompt({
      persona,
      taskMode,
      aiMode: mode,
      customInstructions: customSystemPrompt,
      memoryContext: useMemory && memory ? memory : undefined,
    });

    // Initiate stream directly to AI provider
    const { stream: aiStream, modelUsed, fallbackUsed } = await createChatStream({
      messages: history,
      systemPrompt,
      model,
      attachments,
      signal: request.signal,
    });

    // Stream accumulator & background persistence
    let fullResponseText = "";
    const decoder = new TextDecoder();

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        fullResponseText += text;
        controller.enqueue(chunk);
      },
      async flush() {
        const trimmed = fullResponseText.trim();
        if (trimmed) {
          try {
            // Persist assistant message in background
            addMessage({
              conversation_id: conversationId,
              user_id: user.id,
              role: "assistant",
              content: trimmed,
              model: modelUsed,
            });

            // Auto-generate professional conversation title
            const isPlaceholderTitle =
              !conversation.title ||
              conversation.title === "New Chat" ||
              conversation.title === "New Conversation" ||
              conversation.title === "Welcome to ZeroGen" ||
              conversation.title.startsWith("temp_");

            if (isPlaceholderTitle && messageText) {
              try {
                const newTitle = await generateConversationTitle(messageText);
                touchConversation(conversationId, user.id, newTitle);
              } catch (titleErr) {
                console.error("[api/chat] Title generation error:", titleErr);
                touchConversation(conversationId, user.id);
              }
            } else {
              touchConversation(conversationId, user.id);
            }

            // Update memory context if enabled
            if (useMemory && messageText) {
              const currentMemory = memory || "";
              const newMemoryEntry = `User: ${messageText.slice(0, 100)}\nZeroGen: ${trimmed.slice(0, 150)}`;
              const combinedMemory = currentMemory === "No saved memory yet." || !currentMemory
                ? newMemoryEntry
                : `${currentMemory}\n---\n${newMemoryEntry}`.slice(-2000);
              updateUserSettings(user.id, { memory: combinedMemory });
            }
          } catch (dbError) {
            console.error("[api/chat] Background persistence error:", dbError);
          }
        }
      },
    });

    const responseStream = aiStream.pipeThrough(transformStream);

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-ZeroGen-Model": modelUsed,
        "X-ZeroGen-Fallback": String(fallbackUsed),
      },
    });
  } catch (error: unknown) {
    console.error("[api/chat] Error generating chat response:", error);
    const friendlyErrorMessage = formatAIError(error);
    return new Response(
      JSON.stringify({
        error: friendlyErrorMessage,
        reply: `ZeroGen notice: ${friendlyErrorMessage}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}