import { cookies } from "next/headers";

export const SESSION_COOKIE = "ai901_session";

export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error(
      "Falta la variable de entorno BACKEND_URL. Configúrala en .env.local.",
    );
  }
  return url.replace(/\/+$/, "");
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export function sessionCookieOptions(token: string, expiresAt?: string) {
  let maxAge = 60 * 60 * 8;
  if (expiresAt) {
    const parsed = new Date(expiresAt).getTime();
    if (Number.isFinite(parsed)) {
      maxAge = Math.max(60, Math.floor((parsed - Date.now()) / 1000));
    }
  }
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
