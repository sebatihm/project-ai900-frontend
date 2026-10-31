"use client";

import { useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-context";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { downloadFile } from "@/lib/download";
import { formatMoney, toProxyPath } from "@/lib/format";
import { canGenerateReports } from "@/lib/permissions";
import type { ReportSalesResponse } from "@/lib/types";

export default function ReportsPage() {
  const { user } = useAuth();
  const [branchId, setBranchId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportSalesResponse | null>(null);

  if (!user) return null;
  if (!canGenerateReports(user.role)) return <AccessDenied />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    const payload: Record<string, string | number> = {};
    if (branchId.trim()) payload.branchId = branchId.trim();
    if (from) payload.from = from;
    if (to) payload.to = to;
    if (month) payload.month = Number(month);
    if (year) payload.year = Number(year);

    try {
      const result = await apiRequest<ReportSalesResponse>("/api/report/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setReport(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!report) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadFile(
        toProxyPath(report.downloadPath),
        report.filename || "informe-ventas.docx",
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Informes de ventas"
        description="Genera el informe en Word sin depender del chat. El periodo lo decide el backend; si envías un rango, tiene prioridad sobre mes y año."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form className="app-card p-6" onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold">Nuevo informe</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sin filtros se genera el mes en curso con las sucursales a las que
            tu rol tiene acceso.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="branchId" className="form-label">
                Sucursal (UUID, opcional)
              </label>
              <input
                id="branchId"
                className="form-control"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                placeholder="33333333-3333-4333-8333-000000000001"
              />
              <p className="form-text">
                Ejemplo de sucursal demo: TST-CDMX con el UUID de arriba.
              </p>
            </div>

            <div>
              <label htmlFor="month" className="form-label">
                Mes
              </label>
              <select
                id="month"
                className="form-select"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                <option value="">Mes actual</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {new Intl.DateTimeFormat("es-MX", {
                        month: "long",
                      }).format(new Date(2026, value - 1, 1))}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label htmlFor="year" className="form-label">
                Año
              </label>
              <input
                id="year"
                type="number"
                min="2000"
                max="2100"
                className="form-control"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder={String(new Date().getFullYear())}
              />
            </div>

            <div>
              <label htmlFor="from" className="form-label">
                Desde
              </label>
              <input
                id="from"
                type="date"
                className="form-control"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="to" className="form-label">
                Hasta
              </label>
              <input
                id="to"
                type="date"
                className="form-control"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-brand mt-5 w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                />
                Generando informe…
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
                Generar informe
              </>
            )}
          </button>
        </form>

        <section className="app-card p-6">
          <h2 className="text-lg font-semibold">Resultado</h2>
          {!report && !error && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Completa el formulario para generar un informe. La descarga
              directa del chat también está disponible y usa el mismo proxy con
              Bearer.
            </p>
          )}

          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}

          {report && (
            <div className="mt-3">
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">Archivo</dt>
                  <dd className="break-all text-[var(--muted)]">
                    {report.filename}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Periodo</dt>
                  <dd className="text-[var(--muted)]">{report.period}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Alcance</dt>
                  <dd className="text-[var(--muted)]">{report.scope}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="font-semibold">Pedidos</dt>
                    <dd className="text-[var(--muted)]">{report.orders}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-[var(--muted)]">
                      {formatMoney(report.total)}
                    </dd>
                  </div>
                </div>
              </dl>

              <button
                type="button"
                className="btn btn-brand mt-5 w-full"
                onClick={() => void handleDownload()}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    />
                    Descargando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-1" aria-hidden="true" />
                    Descargar .docx
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-[var(--muted)]">
                El enlace caduca en {report.expiresInMinutes} minutos. Si
                caduca, genera otro informe.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
