import { forwardRequest } from "@/lib/proxy";

export async function GET(request: Request) {
  return forwardRequest(request, "auth/me");
}
