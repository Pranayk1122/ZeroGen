import { cookies } from "next/headers";
import { findSessionByToken, createSession, deleteSessionByToken, User, Session } from "./db";
import { generateToken } from "./crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "zerogen_session";
export const SESSION_DURATION_DAYS = 30;

export async function getCurrentUser(): Promise<(Omit<User, "password_hash"> & { sessionId: string }) | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const sessionData = findSessionByToken(token);
    if (!sessionData) return null;

    return {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      created_at: sessionData.user.created_at,
      updated_at: sessionData.user.updated_at,
      sessionId: sessionData.id,
    };
  } catch (error) {
    console.error("[session] Error getting current user:", error);
    return null;
  }
}

export async function createAndSetSession(userId: string): Promise<Session> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const session = createSession(userId, token, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      deleteSessionByToken(token);
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error("[session] Error destroying session:", error);
  }
}

export function unauthorizedResponse(message = "Unauthorized. Please sign in.") {
  return NextResponse.json({ error: message }, { status: 401 });
}
