import { forwardRequest } from "@/lib/proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return forwardRequest(request, `report/download/${encodeURIComponent(token)}`, {
    preserveResponseHeaders: ["content-disposition"],
  });
}
