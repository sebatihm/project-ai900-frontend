import { forwardRequest, isPublicBackendPath } from "@/lib/proxy";

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  const backendPath = path.join("/");
  return forwardRequest(request, backendPath, {
    publicPath: isPublicBackendPath(path),
    preserveResponseHeaders: ["content-disposition"],
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
