import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type MessagePayload = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AttachmentPayload = {
  name: string;
  type: string;
  size: string;
  content?: string;
};

export type GenerateStreamOptions = {
  messages: MessagePayload[];
  systemPrompt: string;
  model?: string;
  attachments?: AttachmentPayload[];
  signal?: AbortSignal;
};

export type ModelOption = {
  id: string;
  name: string;
  tier: "fast" | "pro" | "ultra";
  description: string;
  badge?: string;
  isDefault?: boolean;
};

/**
 * Returns user-facing ZeroGen-branded model tiers only.
 * Internal provider model names are never exposed to the client.
 */
export function getAvailableModels(): ModelOption[] {
  return [
    {
      id: "zerogen-fast",
      name: "ZeroGen Fast",
      tier: "fast",
      description: "Low-latency response & instant streaming for quick answers",
      badge: "Fast",
      isDefault: true,
    },
    {
      id: "zerogen-pro",
      name: "ZeroGen Pro",
      tier: "pro",
      description: "Balanced intelligence for complex code, writing & problem solving",
      badge: "Pro",
    },
    {
      id: "zerogen-ultra",
      name: "ZeroGen Ultra",
      tier: "ultra",
      description: "Deep reasoning & maximum context understanding",
      badge: "Ultra",
    },
  ];
}

/**
 * Internal Server-Side Tier Routing Configuration.
 * Maps ZeroGen user-facing tiers to verified provider backends.
 */
const TIER_MAPPINGS: Record<
  string,
  {
    displayName: string;
    primaryGemini: string;
    fallbacks: string[];
    openaiModel?: string;
  }
> = {
  "zerogen-fast": {
    displayName: "ZeroGen Fast",
    primaryGemini: "gemini-3.5-flash-lite",
    fallbacks: ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
    openaiModel: "gpt-4o-mini",
  },
  "zerogen-pro": {
    displayName: "ZeroGen Pro",
    primaryGemini: "gemini-3.5-flash",
    fallbacks: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"],
    openaiModel: "gpt-4o",
  },
  "zerogen-ultra": {
    displayName: "ZeroGen Ultra",
    primaryGemini: "gemini-3.6-flash",
    fallbacks: ["gemini-3.5-flash", "gemini-3.5-flash-lite"],
    openaiModel: "gpt-4o",
  },
};

/**
 * Cleanly extracts a human-friendly message from raw provider errors.
 */
export function formatAIError(error: unknown): string {
  if (!error) return "An unexpected error occurred while communicating with the ZeroGen AI engine.";

  const raw = error instanceof Error ? error.message : String(error);

  // Check for JSON embedded in error message
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error?.message) {
        const nestedMsg = parsed.error.message;
        if (nestedMsg.includes("high demand") || parsed.error.code === 503) {
          return "The AI engine is currently experiencing high demand. Please retry your message in a few moments.";
        }
        if (nestedMsg.includes("quota") || parsed.error.code === 429) {
          return "The AI engine rate limit was temporarily reached. Please wait a moment before trying again.";
        }
        if (parsed.error.code === 404) {
          return "The requested tier is currently updating. ZeroGen is automatically routing to an active tier.";
        }
        return nestedMsg;
      }
    }
  } catch {
    // ignore parse failure
  }

  if (raw.includes("503") || raw.includes("high demand") || raw.includes("UNAVAILABLE")) {
    return "The ZeroGen AI engine is currently experiencing peak demand. Please retry in a few moments.";
  }
  if (raw.includes("429") || raw.includes("quota") || raw.includes("RATE_LIMIT")) {
    return "Rate limit reached. Please wait a moment before sending another request.";
  }
  if (raw.includes("401") || raw.includes("API key")) {
    return "ZeroGen API key configuration is missing or unauthorized. Please verify .env.local.";
  }

  return raw.replace(/https?:\/\/\S+/g, "").trim();
}

/**
 * Output sanitizer to guarantee ZeroGen product identity.
 */
export function sanitizeAIIdentity(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b(?:I am|I'm)\s+Gemini\b/gi, "I'm ZeroGen")
    .replace(/\b(?:I was|I am|I'm)\s+(?:created|trained|developed|made|built)\s+by\s+Google\b/gi, "I was developed for the ZeroGen project")
    .replace(/\bGoogle\s+(?:created|trained|made|built)\s+me\b/gi, "ZeroGen was developed by the ZeroGen team")
    .replace(/\b(?:I was|I am|I'm)\s+(?:created|trained|developed|made|built)\s+by\s+OpenAI\b/gi, "I was developed for the ZeroGen project")
    .replace(/\bOpenAI\s+(?:created|trained|made|built)\s+me\b/gi, "ZeroGen was developed by the ZeroGen team")
    .replace(/\ba\s+large\s+language\s+model,?\s+trained\s+by\s+Google\b/gi, "ZeroGen, an AI assistant")
    .replace(/\ba\s+large\s+language\s+model,?\s+trained\s+by\s+OpenAI\b/gi, "ZeroGen, an AI assistant");
}

let cachedGeminiClient: GoogleGenAI | null = null;
let cachedApiKey = "";

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedGeminiClient || cachedApiKey !== apiKey) {
    cachedGeminiClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedGeminiClient;
}

/**
 * Creates a real streaming response using ZeroGen-branded tiers.
 */
export async function createChatStream(options: GenerateStreamOptions): Promise<{
  stream: ReadableStream<Uint8Array>;
  modelUsed: string;
  zerogenTier: string;
  fallbackUsed: boolean;
}> {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const hasOpenAI = Boolean(openaiApiKey && !openaiApiKey.includes("replace"));

  const requestedTierId = options.model || "zerogen-fast";
  const tierConfig = TIER_MAPPINGS[requestedTierId] || TIER_MAPPINGS["zerogen-fast"];

  if (geminiApiKey) {
    const { stream, fallbackUsed } = await createGeminiStream(options, tierConfig, geminiApiKey);
    return {
      stream,
      modelUsed: tierConfig.displayName,
      zerogenTier: tierConfig.displayName,
      fallbackUsed,
    };
  } else if (hasOpenAI && tierConfig.openaiModel) {
    const { stream } = await createOpenAIStream(options, tierConfig.openaiModel, openaiApiKey!);
    return {
      stream,
      modelUsed: tierConfig.displayName,
      zerogenTier: tierConfig.displayName,
      fallbackUsed: false,
    };
  } else {
    throw new Error("ZeroGen is not configured with an active AI provider API key in .env.local.");
  }
}

async function createGeminiStream(
  options: GenerateStreamOptions,
  tierConfig: { displayName: string; primaryGemini: string; fallbacks: string[] },
  apiKey: string
): Promise<{ stream: ReadableStream<Uint8Array>; fallbackUsed: boolean }> {
  const client = getGeminiClient(apiKey);

  // Format messages (last 8 turns for fast context)
  const history = options.messages.slice(-8);
  const formattedContents = history.map((msg) => {
    let text = msg.content;
    if (msg.role === "user" && options.attachments?.length) {
      const attachmentsSummary = options.attachments
        .map((a) => `[Attachment: ${a.name} (${a.type}, ${a.size})${a.content ? `\nContent:\n${a.content}` : ""}]`)
        .join("\n\n");
      text = `${text}\n\n${attachmentsSummary}`;
    }
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    };
  });

  const candidates = [tierConfig.primaryGemini, ...tierConfig.fallbacks];
  const uniqueCandidates = Array.from(new Set(candidates));

  let activeStream: any = null;
  let fallbackOccurred = false;
  let lastError: unknown = null;

  for (const candidate of uniqueCandidates) {
    try {
      activeStream = await client.models.generateContentStream({
        model: candidate,
        contents: formattedContents,
        config: {
          systemInstruction: options.systemPrompt,
          temperature: 0.7,
        },
      });
      if (candidate !== tierConfig.primaryGemini) {
        fallbackOccurred = true;
        console.warn(`[ZeroGen] Primary provider route failed, seamlessly routed to high-availability channel.`);
      }
      break;
    } catch (err: unknown) {
      lastError = err;
      console.warn(`[ZeroGen] Internal channel failover:`, formatAIError(err));
    }
  }

  if (!activeStream) {
    throw new Error(formatAIError(lastError));
  }

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of activeStream) {
          if (options.signal?.aborted) {
            controller.close();
            return;
          }
          const text = chunk.text;
          if (text) {
            const cleanText = sanitizeAIIdentity(text);
            controller.enqueue(encoder.encode(cleanText));
          }
        }
        controller.close();
      } catch (streamIterError) {
        console.error("[ZeroGen] Stream error:", streamIterError);
        controller.error(new Error(formatAIError(streamIterError)));
      }
    },
  });

  return {
    stream: readableStream,
    fallbackUsed: fallbackOccurred,
  };
}

async function createOpenAIStream(
  options: GenerateStreamOptions,
  modelName: string,
  apiKey: string
): Promise<{ stream: ReadableStream<Uint8Array> }> {
  const client = new OpenAI({ apiKey });

  const history = options.messages.slice(-8);
  const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: options.systemPrompt },
    ...history.map((msg) => {
      let content = msg.content;
      if (msg.role === "user" && options.attachments?.length) {
        const attachSummary = options.attachments
          .map((a) => `[Attachment: ${a.name} (${a.type}, ${a.size})${a.content ? `\nContent:\n${a.content}` : ""}]`)
          .join("\n\n");
        content = `${content}\n\n${attachSummary}`;
      }
      return {
        role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content,
      };
    }),
  ];

  try {
    const responseStream = await client.chat.completions.create({
      model: modelName,
      messages: openAiMessages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (options.signal?.aborted) {
              controller.close();
              return;
            }
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              const cleanText = sanitizeAIIdentity(text);
              controller.enqueue(encoder.encode(cleanText));
            }
          }
          controller.close();
        } catch (error) {
          console.error("[ZeroGen] OpenAI stream error:", error);
          controller.error(new Error(formatAIError(error)));
        }
      },
    });

    return { stream: readableStream };
  } catch (err) {
    throw new Error(formatAIError(err));
  }
}
