import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createAndSetSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = findUserByEmail(trimmedEmail);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await createAndSetSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[api/auth/login] Error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
