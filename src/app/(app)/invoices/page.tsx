"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/components/auth-context";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/format";
import { canAnalyzeInvoices } from "@/lib/permissions";
import type {
  ApiResponse,
  InvoiceAnalysis,
  InvoiceSummary,
  PaginatedResponse,
  SupplierSummary,
} from "@/lib/types";

const STATUS_META: Record<
  InvoiceAnalysis["status"],
  { label: string; badge: string; description: string }
> = {
  VALID: {
    label: "Válida",
    badge: "text-bg-success",
    description:
      "La factura pasó las reglas de validación y puede registrarse en el sistema.",
  },
  SUSPICIOUS: {
    label: "Sospechosa",
    badge: "text-bg-warning",
    description:
      "La factura requiere revisión manual antes de aprobarse. Revisa los motivos de sospecha.",
  },
  REJECTED: {
    label: "Rechazada",
    badge: "text-bg-danger",
    description:
      "La factura incumple reglas críticas y no debe registrarse sin corrección.",
  },
};

function money(value: number | null, currency: string | null): string {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
    }).format(value);
  } catch {
    return `${value} ${currency ?? ""}`.trim();
  }
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState(
    "77777777-7777-4777-8777-000000000001",
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<InvoiceAnalysis | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [invoiceOffset, setInvoiceOffset] = useState(0);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (!user || !canAnalyzeInvoices(user.role)) return;
    apiRequest<ApiResponse<PaginatedResponse<SupplierSummary>>>(
      "/api/supplier?offset=0&limit=100",
    )
      .then((payload) => {
        setSuppliers(payload.data.items);
        setSupplierId((current) => current || payload.data.items[0]?.id || "");
      })
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setSuppliersLoading(false));
  }, [user]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(invoiceOffset),
        limit: "10",
      });
      if (invoiceStatus) params.set("status", invoiceStatus);
      const payload = await apiRequest<
        ApiResponse<PaginatedResponse<InvoiceSummary>>
      >(`/api/invoice?${params.toString()}`);
      setInvoices(payload.data.items);
      setInvoiceTotal(payload.data.total);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setInvoicesLoading(false);
    }
  }, [invoiceOffset, invoiceStatus]);

  useEffect(() => {
    if (!user || !canAnalyzeInvoices(user.role)) return;
    void loadInvoices();
  }, [loadInvoices, user]);

  if (!user) return null;
  if (!canAnalyzeInvoices(user.role)) return <AccessDenied />;

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!supplierId.trim()) {
      setError("Selecciona un proveedor.");
      return;
    }
    if (!file) {
      setError("Selecciona un archivo PDF, JPG o PNG.");
      return;
    }

    setBusy(true);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const payload = await apiRequest<ApiResponse<InvoiceAnalysis>>(
        `/api/invoice-analyzer/${supplierId.trim()}`,
        {
          method: "POST",
          body: formData,
        },
      );
      setAnalysis(payload.data);
      await loadInvoices();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }

  }

  async function viewInvoice(id: string) {
    setError(null);
    try {
      const payload = await apiRequest<ApiResponse<InvoiceAnalysis>>(
        `/api/invoice/${id}`,
      );
      setAnalysis(payload.data);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function reviewInvoice(action: "APPROVE" | "REJECT") {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiRequest<ApiResponse<InvoiceAnalysis>>(
        `/api/invoice/${analysis.invoiceId}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            comment: reviewComment.trim() || null,
          }),
        },
      );
      setAnalysis(payload.data);
      setReviewComment("");
      await loadInvoices();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Análisis de facturas"
        description="Selecciona un proveedor y sube un PDF o imagen para analizar la factura."
      />

      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar error"
              onClick={() => setError(null)}
            />
          </div>
        </div>
      )}

      <section className="app-card p-5">
        <form onSubmit={analyze} className="grid gap-4">
          <div>
            <label htmlFor="supplier-id" className="form-label">
              Proveedor *
            </label>
            <select
              id="supplier-id"
              className="form-select"
              required
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              disabled={suppliersLoading}
            >
              <option value="">
                {suppliersLoading ? "Cargando proveedores…" : "Selecciona un proveedor"}
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.rfc})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="invoice-file" className="form-label">
              Archivo *
            </label>
            <input
              ref={fileRef}
              id="invoice-file"
              className="form-control"
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="form-text">
              PDF de hasta 5 páginas, JPG o PNG de al menos 800×600 px y máximo
              10 MB. La extensión debe coincidir con el contenido real.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-brand" disabled={busy}>
              {busy ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Analizando…
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-check me-1" aria-hidden="true" />
                  Analizar factura
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={reset}
              disabled={busy}
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="app-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold">Facturas registradas</h2>
            <p className="text-sm text-[var(--muted)]">
              Consulta el historial y abre el detalle de cualquier factura.
            </p>
          </div>
          <select
            className="form-select form-select-sm w-auto"
            value={invoiceStatus}
            onChange={(event) => {
              setInvoiceStatus(event.target.value);
              setInvoiceOffset(0);
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th className="text-end">Total</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {!invoicesLoading && invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-5 text-center text-[var(--muted)]">
                    No hay facturas registradas.
                  </td>
                </tr>
              )}
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.originalFileName}</td>
                  <td>{invoice.supplierName}</td>
                  <td>
                    <span className={`badge ${STATUS_META[invoice.status].badge}`}>
                      {STATUS_META[invoice.status].label}
                    </span>
                  </td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td className="text-end">
                    {money(invoice.total, invoice.currency)}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-brand"
                      onClick={() => void viewInvoice(invoice.id)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={invoiceOffset === 0 || invoicesLoading}
            onClick={() => setInvoiceOffset(Math.max(0, invoiceOffset - 10))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={invoiceOffset + 10 >= invoiceTotal || invoicesLoading}
            onClick={() => setInvoiceOffset(invoiceOffset + 10)}
          >
            Siguiente
          </button>
        </div>
      </section>

      {analysis && (
        <div className="mt-5 space-y-5">
          <section className="app-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {analysis.originalFileName}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Analizada el {formatDateTime(analysis.createdAt)}
                </p>
              </div>
              <span className={`badge ${STATUS_META[analysis.status].badge}`}>
                {STATUS_META[analysis.status].label} ·{" "}
                {analysis.suspicionScore} pts
              </span>
            </div>
            <p className="mt-3 text-sm">
              {STATUS_META[analysis.status].description}
            </p>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-semibold">Proveedor</dt>
                <dd>{analysis.supplierName}</dd>
              </div>
              <div>
                <dt className="font-semibold">Número de factura</dt>
                <dd>{analysis.invoiceNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Fecha</dt>
                <dd>{formatDate(analysis.invoiceDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Vencimiento</dt>
                <dd>{formatDate(analysis.dueDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Subtotal</dt>
                <dd>{money(analysis.subtotal, analysis.currency)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Impuestos</dt>
                <dd>{money(analysis.tax, analysis.currency)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">
                  {money(analysis.total, analysis.currency)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Confianza mínima OCR</dt>
                <dd>
                  {analysis.minConfidence === null
                    ? "—"
                    : `${Math.round(analysis.minConfidence * 100)}%`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Contenedor</dt>
                <dd>{analysis.container}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-semibold">SHA-256</dt>
                <dd className="break-all font-mono text-xs">{analysis.sha256}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-semibold">Ruta en almacenamiento</dt>
                <dd className="break-all font-mono text-xs">{analysis.blobPath}</dd>
              </div>
            </dl>

            {analysis.readUrl && (
              <a
                href={analysis.readUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-brand mt-4 btn-sm"
              >
                <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
                Abrir archivo original
              </a>
            )}

            {analysis.status === "SUSPICIOUS" && (
              <div className="mt-5 rounded-xl border border-[var(--border)] p-4">
                <h3 className="font-semibold">Revisión de la factura</h3>
                <label htmlFor="review-comment" className="form-label mt-3">
                  Comentario (opcional)
                </label>
                <textarea
                  id="review-comment"
                  className="form-control"
                  rows={3}
                  maxLength={500}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Escribe una observación para dejar constancia de la revisión."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={busy}
                    onClick={() => void reviewInvoice("APPROVE")}
                  >
                    Aprobar factura
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={busy}
                    onClick={() => void reviewInvoice("REJECT")}
                  >
                    Rechazar factura
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="app-card overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <h2 className="text-lg font-semibold">Motivos de sospecha</h2>
            </div>
            {analysis.reasons.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[var(--muted)]">
                No se detectaron motivos de sospecha.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Regla</th>
                      <th scope="col">Puntos</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.reasons.map((reason, index) => (
                      <tr key={`${reason.rule}-${index}`}>
                        <td className="font-mono text-xs">{reason.rule}</td>
                        <td>
                          <span className="badge text-bg-light border">
                            +{reason.points}
                          </span>
                        </td>
                        <td>{reason.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="app-card overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <h2 className="text-lg font-semibold">
                Partidas ({analysis.items.length})
              </h2>
            </div>
            {analysis.items.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[var(--muted)]">
                No se extrajeron partidas de la factura.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Descripción</th>
                      <th scope="col" className="text-end">
                        Cantidad
                      </th>
                      <th scope="col" className="text-end">
                        Importe
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.items.map((item, index) => (
                      <tr key={`${item.description}-${index}`}>
                        <td>{item.description}</td>
                        <td className="text-end">{item.quantity}</td>
                        <td className="text-end">
                          {money(item.amount, analysis.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
