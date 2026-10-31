import { forwardRequest } from "@/lib/proxy";

export async function POST(request: Request) {
  return forwardRequest(request, "chat/public", { publicPath: true });
}
