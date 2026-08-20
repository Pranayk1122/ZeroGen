import { NextResponse } from "next/server";
import { getAvailableModels } from "@/lib/ai";

export async function GET() {
  try {
    const models = getAvailableModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error("[api/models] Error:", error);
    return NextResponse.json({ error: "Failed to load models" }, { status: 500 });
  }
}
