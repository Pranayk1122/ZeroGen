import { NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

type ChatRole = "user" | "assistant";

type ChatEntry = {
  role: ChatRole;
  content: string;
};

type RequestPayload = {
  message?: string;
  history?: ChatEntry[];
  persona?: string;
  mode?: string;
  taskMode?: string;
  systemPrompt?: string;
  useMemory?: boolean;
  memory?: string;
  attachments?: Array<{
    name: string;
    type: string;
    size: string;
  }>;
  kind?: string;
  imagePrompt?: string;
  imageStyle?: string;
  model?: string;
  stream?: boolean;
};

const SYSTEM_PROMPT =
  "You are ZeroGen, a helpful, practical, intelligent AI assistant.";

function buildPrompt(payload: RequestPayload) {
  const history = (payload.history ?? []).slice(-10);

  const conversation = history
    .map(
      (entry) =>
        `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.content}`
    )
    .join("\n");

  return [
    payload.systemPrompt || SYSTEM_PROMPT,
    `Persona: ${payload.persona || "helper"}`,
    `Mode: ${payload.mode || "fast"}`,
    `Task: ${payload.taskMode || "default"}`,
    payload.useMemory && payload.memory
      ? `Memory: ${payload.memory}`
      : "Memory: none",
    conversation
      ? `Conversation:\n${conversation}`
      : "Conversation: none",
    payload.attachments?.length
      ? `Attachments:\n${payload.attachments
          .map(
            (file) =>
              `- ${file.name} (${file.type}, ${file.size})`
          )
          .join("\n")}`
      : "Attachments: none",
    `Latest user message: ${payload.message || ""}`,
  ].join("\n\n");
}

function localReply(payload: RequestPayload) {
  const message = (payload.message || "").trim();

  if (!message) {
    return "Please enter a message and I'll help you.";
  }

  const lower = message.toLowerCase();

  if (
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    lower.startsWith("hi ")
  ) {
    return "Hello! I'm ZeroGen. How can I help you?";
  }

  if (lower.includes("your name")) {
    return "I'm ZeroGen, your AI assistant.";
  }

  return `I'm ZeroGen. I received your message: "${message}"\n\nConnect an OpenAI or Gemini API key to enable full AI responses.`;
}

function hasOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) return false;

  const invalidValues = [
    "replace_with_real_openai_key",
    "replace_with_openai_key",
    "your_openai_api_key",
    "your-api-key",
  ];

  return !invalidValues.includes(key.toLowerCase());
}

function hasGeminiKey() {
  return Boolean(
    process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim()
  );
}

async function generateWithOpenAI(payload: RequestPayload) {
  if (!hasOpenAIKey()) {
    return null;
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const model =
    process.env.OPENAI_MODEL?.trim() ||
    payload.model ||
    "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: payload.systemPrompt || SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildPrompt(payload),
      },
    ],
    temperature: 0.7,
    max_tokens: 1200,
  });

  return completion.choices?.[0]?.message?.content?.trim() || null;
}

async function generateWithGemini(payload: RequestPayload) {
  if (!hasGeminiKey()) {
    return null;
  }

  const apiKey =
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const client = new GoogleGenAI({
    apiKey,
  });

  const model =
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash";

  const response = await client.models.generateContent({
    model,
    contents: buildPrompt(payload),
  });

  return response.text?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Request must use application/json.",
        },
        { status: 400 }
      );
    }

    let payload: RequestPayload;

    try {
      payload = (await request.json()) as RequestPayload;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    if (!payload.message?.trim() && payload.kind !== "image") {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        { status: 400 }
      );
    }

    console.log("[api/chat] Request received");
    console.log(
      "[api/chat] OpenAI:",
      hasOpenAIKey() ? "available" : "not configured"
    );
    console.log(
      "[api/chat] Gemini:",
      hasGeminiKey() ? "available" : "not configured"
    );

    /*
     * Image requests currently return a safe placeholder response.
     * This prevents the API route from failing while the real image
     * generation provider is configured.
     */
    if (payload.kind === "image") {
      return NextResponse.json({
        reply:
          payload.imagePrompt ||
          "Image generation request received.",
        provider: "local",
      });
    }

    let reply: string | null = null;
    let provider = "local";

    /*
     * Priority:
     * 1. OpenAI
     * 2. Gemini
     * 3. Local fallback
     */

    if (hasOpenAIKey()) {
      try {
        reply = await generateWithOpenAI(payload);

        if (reply) {
          provider = "openai";
        }
      } catch (error) {
        console.error(
          "[api/chat] OpenAI failed:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    if (!reply && hasGeminiKey()) {
      try {
        reply = await generateWithGemini(payload);

        if (reply) {
          provider = "gemini";
        }
      } catch (error) {
        console.error(
          "[api/chat] Gemini failed:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    if (!reply) {
      reply = localReply(payload);
      provider = "local";
    }

    console.log(
      `[api/chat] Response generated using ${provider}`
    );

    return NextResponse.json({
      reply,
      provider,
    });
  } catch (error) {
    console.error(
      "[api/chat] Unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error: "The ZeroGen API encountered an unexpected error.",
        reply:
          "Sorry, I couldn't generate a response right now.",
      },
      { status: 500 }
    );
  }
}