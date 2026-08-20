import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserSettings } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null, settings: null });
    }

    const settings = getUserSettings(user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      settings,
    });
  } catch (error) {
    console.error("[api/auth/me] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve auth state" }, { status: 500 });
  }
}
