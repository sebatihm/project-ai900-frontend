import { NextResponse } from "next/server";
import { forwardRequest } from "@/lib/proxy";

type Context = { params: Promise<{ supplierId: string }> };

const PUBLIC_FIELDS = [
  "invoiceId",
  "status",
  "suspicionScore",
  "reasons",
  "supplierId",
  "supplierName",
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "subtotal",
  "tax",
  "total",
  "currency",
  "items",
  "createdAt",
] as const;

function sanitize(body: unknown): unknown {
  const payload = body as { data?: Record<string, unknown> };
  if (!payload?.data) return body;
  const data = payload.data;
  const sanitized = Object.fromEntries(
    PUBLIC_FIELDS.filter((field) => field in data).map((field) => [
      field,
      data[field],
    ]),
  );
  return { ...payload, data: sanitized };
}

export async function POST(request: Request, context: Context) {
  const key = process.env.PUBLIC_UPLOAD_KEY;
  if (!key) {
    return NextResponse.json(
      { detail: "El analizador público no está configurado." },
      { status: 503 },
    );
  }

  const { supplierId } = await context.params;

  return forwardRequest(request, `public/invoice-analyzer/${supplierId}`, {
    publicPath: true,
    extraHeaders: { "X-Public-Upload-Key": key },
    transformJson: sanitize,
  });
}
