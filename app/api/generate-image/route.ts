import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/session";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const { prompt, style } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
    const hasOpenAI = Boolean(openAiApiKey && !openAiApiKey.includes("replace"));

    if (!hasOpenAI) {
      return NextResponse.json(
        {
          error: "Image generation is not currently configured. An OpenAI API key with DALL-E capability is required.",
          available: false,
        },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey: openAiApiKey });
    const enrichedPrompt = style ? `${prompt.trim()}, ${style} style, high resolution, detailed` : prompt.trim();

    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: enrichedPrompt,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "Failed to generate image from provider." }, { status: 500 });
    }

    return NextResponse.json({
      imageUrl,
      prompt: prompt.trim(),
      style: style || "standard",
    });
  } catch (error: unknown) {
    console.error("[api/generate-image] Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to generate image.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
