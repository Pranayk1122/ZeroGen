import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("[api/auth/logout] Error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
