import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ supplierId: string }>;
};

export default async function LegacyInvoiceAnalyzerPage({ params }: Props) {
  const { supplierId } = await params;
  redirect(`/chat/invoice-analyzer/${encodeURIComponent(supplierId)}`);
}
