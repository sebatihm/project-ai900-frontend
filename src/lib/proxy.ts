import { NextResponse } from "next/server";
import { getBackendUrl, getSessionToken, SESSION_COOKIE } from "@/lib/session";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
]);

const PUBLIC_BACKEND_PATHS = new Set(["chat/public"]);

export type ProxyOptions = {
  publicPath?: boolean;
  preserveResponseHeaders?: string[];
};

function buildHeaders(request: Request, token: string | null) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && lower !== "authorization") {
      headers.set(key, value);
    }
  });
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function forwardRequest(
  request: Request,
  backendPath: string,
  options: ProxyOptions = {},
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!options.publicPath && !token) {
    return NextResponse.json(
      { detail: "Sesión no iniciada o caducada" },
      { status: 401 },
    );
  }

  const target = `${getBackendUrl()}/${backendPath.replace(/^\/+/, "")}`;
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const init = {
    method,
    headers: buildHeaders(request, options.publicPath ? null : token),
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
    cache: "no-store",
  } as RequestInit & { duplex?: "half" };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { detail: "No se pudo contactar con el servidor de la API" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of [
    "content-type",
    "content-disposition",
    "content-length",
    "cache-control",
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const name of options.preserveResponseHeaders ?? []) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (upstream.status === 401) {
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

  return response;
}

export function isPublicBackendPath(path: string[] | string): boolean {
  const normalized = Array.isArray(path) ? path.join("/") : path;
  return PUBLIC_BACKEND_PATHS.has(normalized.replace(/^\/+/, ""));
}
