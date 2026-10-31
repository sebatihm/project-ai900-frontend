import { NextResponse } from "next/server";
import { getBackendUrl, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import type { ApiResponse, LoginResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendUrl()}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "No se pudo contactar con el servidor de la API" },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  const response = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });

  if (upstream.ok) {
    try {
      const payload = JSON.parse(text) as ApiResponse<LoginResponse>;
      if (payload.data?.token) {
        response.cookies.set(
          sessionCookieOptions(payload.data.token, payload.data.expiresAt),
        );
      }
    } catch {
      response.cookies.set({
        name: SESSION_COOKIE,
        value: "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }
  }

  return response;
}
