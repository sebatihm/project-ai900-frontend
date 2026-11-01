"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { readErrorDetail } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ApiResponse, PublicInvoiceAnalysis } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STATUS_META: Record<
  PublicInvoiceAnalysis["status"],
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

function publicErrorMessage(status: number, detail: string): string {
  switch (status) {
    case 400:
      return detail || "El archivo o los datos enviados no son válidos.";
    case 401:
      return "Este enlace no está autorizado para subir facturas.";
    case 403:
      return "Este enlace no tiene permiso para analizar facturas.";
    case 404:
      return "El proveedor del enlace no existe.";
    case 409:
      return detail || "Ya existe una factura con estos datos.";
    case 413:
      return "El archivo supera el límite de 10 MB.";
    case 415:
      return "El tipo de archivo no es compatible. Usa PDF, JPG o PNG.";
    case 422:
      return detail || "La factura no pudo validarse con los datos extraídos.";
    case 503:
      return "El analizador público no está configurado. Contacta al administrador.";
    default:
      return detail || "No se pudo analizar la factura. Intenta de nuevo.";
  }
}

export default function PublicInvoiceAnalyzerPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PublicInvoiceAnalysis | null>(null);

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supplierId) {
      setError("El enlace no incluye un proveedor válido.");
      return;
    }
    if (!file) {
      setError("Selecciona un archivo PDF, JPG o PNG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("El archivo supera el límite de 10 MB.");
      return;
    }

    setBusy(true);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/public/invoice-analyzer/${encodeURIComponent(supplierId)}`,
        { method: "POST", body: formData },
      );

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(publicErrorMessage(response.status, detail));
      }

      const payload = (await response.json()) as ApiResponse<PublicInvoiceAnalysis>;
      setAnalysis(payload.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo analizar la factura. Intenta de nuevo.",
      );
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
    <div className="min-h-screen">
      <header className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5">
          <i className="bi bi-receipt-cutoff text-3xl" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Portal de facturas</h1>
            <p className="text-sm text-white/80">
              Sube tu factura para validarla de forma segura.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <section className="app-card p-5">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Proveedor del enlace:{" "}
            <code className="break-all">{supplierId}</code>
          </p>

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

          <form onSubmit={analyze} className="grid gap-4">
            <div>
              <label htmlFor="public-invoice-file" className="form-label">
                Archivo *
              </label>
              <input
                ref={fileRef}
                id="public-invoice-file"
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
                    <i
                      className="bi bi-file-earmark-check me-1"
                      aria-hidden="true"
                    />
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

        {analysis && (
          <div className="mt-5 space-y-5">
            <section className="app-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {analysis.invoiceNumber
                      ? `Factura ${analysis.invoiceNumber}`
                      : "Factura analizada"}
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Analizada el {formatDateTime(analysis.createdAt)}
                  </p>
                </div>
                <span
                  className={`badge ${STATUS_META[analysis.status].badge}`}
                >
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
                  <dt className="font-semibold">Moneda</dt>
                  <dd>{analysis.currency ?? "—"}</dd>
                </div>
              </dl>
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
      </main>
    </div>
  );
}
