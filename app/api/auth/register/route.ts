import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createAndSetSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = findUserByEmail(trimmedEmail);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const user = createUser({
      id: userId,
      email: trimmedEmail,
      name: (name && typeof name === "string" && name.trim()) || trimmedEmail.split("@")[0],
      password_hash: passwordHash,
    });

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
    console.error("[api/auth/register] Error:", error);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }
}
