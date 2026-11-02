"use client";

import { useCallback, useEffect, useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/components/auth-context";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { canManageSuppliers } from "@/lib/permissions";
import {ApiResponse, PaginatedResponse, SupplierSummary } from "@/lib/types";

type SupplierForm = {
  name: string;
  rfc: string;
  email: string;
};

const EMPTY_FORM: SupplierForm = {
  name: "",
  rfc: "",
  email: "",
};

export default function SuppliersPage() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierSummary | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      const payload = await apiRequest<ApiResponse<PaginatedResponse<SupplierSummary>>>(
        `/api/supplier?${params.toString()}`,
      );
      setSuppliers(payload.data.items);
      setTotal(payload.data.total);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [offset, limit]);

  useEffect(() => {
    if (!user || !canManageSuppliers(user.role)) return;
    void load();
  }, [load, user]);

  if (!user) return null;
  if (!canManageSuppliers(user.role)) return <AccessDenied />;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(supplier: SupplierSummary) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      rfc: supplier.rfc,
      email: supplier.email || "",
    });
    setModalOpen(true);
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        rfc: form.rfc.trim().toUpperCase(),
        email: form.email.trim() ? form.email.trim() : null,
      };
      await apiRequest(editing ? `/api/supplier/${editing.id}` : "/api/supplier", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setModalOpen(false);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSupplier(supplier: SupplierSummary) {
    if (
      !window.confirm(
        `¿Eliminar el proveedor ${supplier.name} (${supplier.rfc})? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setError(null);
    try {
      await apiRequest(`/api/supplier/${supplier.id}`, { method: "DELETE" });
      if (suppliers.length === 1 && offset > 0) {
        setOffset(Math.max(offset - limit, 0));
      } else {
        await load();
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  const pageEnd = Math.min(offset + limit, total);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Proveedores"
        description="CRUD de proveedores. Muestra el enlace para subir facturas y permite copiarlo o abrirlo en una nueva pestaña."
        actions={
          <button type="button" className="btn btn-brand btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nuevo proveedor
          </button>
        }
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

      <section className="app-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">
            {loading
              ? "Cargando proveedores..."
              : `${total} proveedor(es) encontrados. Mostrando ${total === 0 ? 0 : offset + 1}-${pageEnd}`}
          </p>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="supplier-limit" className="text-sm text-[var(--muted)]">
              Elementos por página
            </label>
            <select
              id="supplier-limit"
              className="form-select form-select-sm w-auto"
              value={limit}
              onChange={(event) => {
                setOffset(0);
                setLimit(Number(event.target.value));
              }}
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">RFC</th>
                <th scope="col">Email</th>
                <th scope="col">Enlace para subir facturas</th>
                <th scope="col" className="text-end">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--muted)]">
                    No hay proveedores registrados.
                  </td>
                </tr>
              )}
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="font-semibold">{supplier.name}</td>
                  <td className="font-mono text-sm">{supplier.rfc}</td>
                  <td>{supplier.email || "-"}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={supplier.invoiceAnalyzerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--brand)] hover:underline"
                      >
                        Abrir portal
                      </a>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => void copyLink(supplier.invoiceAnalyzerUrl)}
                      >
                        <i className="bi bi-clipboard me-1" aria-hidden="true" />
                        Copiar
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)] break-all">
                      {supplier.invoiceAnalyzerUrl}
                    </div>
                  </td>
                  <td className="text-end">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => openEdit(supplier)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void deleteSupplier(supplier)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(offset - limit, 0))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset(offset + limit)}
          >
            Siguiente
          </button>
        </div>
      </section>

      <Modal
        title={editing ? "Editar proveedor" : "Nuevo proveedor"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="supplier-form"
              className="btn btn-brand"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={saveSupplier} className="grid gap-4">
          <div>
            <label htmlFor="supplier-name" className="form-label">
              Nombre *
            </label>
            <input
              id="supplier-name"
              className="form-control"
              required
              maxLength={150}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="supplier-rfc" className="form-label">
              RFC *
            </label>
            <input
              id="supplier-rfc"
              className="form-control"
              required
              maxLength={13}
              value={form.rfc}
              onChange={(event) =>
                setForm((current) => ({ ...current, rfc: event.target.value }))
              }
              placeholder="ABC123456T78"
            />
            <p className="form-text">Se normaliza a mayúsculas.</p>
          </div>
          <div>
            <label htmlFor="supplier-email" className="form-label">
              Email (opcional)
            </label>
            <input
              id="supplier-email"
              className="form-control"
              type="email"
              maxLength={255}
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="ventas@proveedor.com"
            />
          </div>
          {editing && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold">Enlace para subir facturas</p>
              <p className="mt-1 break-all text-[var(--muted)]">
                {editing.invoiceAnalyzerUrl}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={editing.invoiceAnalyzerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-brand"
                >
                  Abrir en nueva pestaña
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => void copyLink(editing.invoiceAnalyzerUrl)}
                >
                  Copiar enlace
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}



