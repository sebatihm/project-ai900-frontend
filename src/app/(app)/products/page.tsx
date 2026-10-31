"use client";

import { useCallback, useEffect, useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/components/auth-context";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import { canManageProducts } from "@/lib/permissions";
import type {
  ApiResponse,
  PaginatedResponse,
  ProductSummary,
} from "@/lib/types";

type ProductForm = {
  sku: string;
  name: string;
  categoryId: string;
  unit: string;
  price: string;
};

const EMPTY_FORM: ProductForm = {
  sku: "",
  name: "",
  categoryId: "",
  unit: "",
  price: "",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductSummary | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());
      const payload = await apiRequest<
        ApiResponse<PaginatedResponse<ProductSummary>>
      >(`/api/product?${params.toString()}`);
      setProducts(payload.data.items);
      setTotal(payload.data.total);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [offset, limit, search]);

  useEffect(() => {
    if (!user || !canManageProducts(user.role)) return;
    void load();
  }, [load, user]);

  if (!user) return null;
  if (!canManageProducts(user.role)) return <AccessDenied />;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(product: ProductSummary) {
    setEditing(product);
    setForm({
      sku: product.sku,
      name: product.name,
      categoryId: product.categoryId,
      unit: product.unit,
      price: String(product.price),
    });
    setModalOpen(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId.trim(),
        unit: form.unit.trim(),
        price: Number(form.price),
      };
      await apiRequest(editing ? `/api/product/${editing.id}` : "/api/product", {
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

  async function deleteProduct(product: ProductSummary) {
    if (
      !window.confirm(
        `¿Eliminar el producto ${product.name} (${product.sku})? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setError(null);
    try {
      await apiRequest(`/api/product/${product.id}`, { method: "DELETE" });
      if (products.length === 1 && offset > 0) {
        setOffset(Math.max(offset - limit, 0));
      } else {
        await load();
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const pageEnd = Math.min(offset + limit, total);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Productos"
        description="Listado paginado con búsqueda y CRUD sobre ProductController. El plan no expone un endpoint de categorías, así que el UUID se captura manualmente."
        actions={
          <button type="button" className="btn btn-brand btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nuevo producto
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

      <section className="app-card mb-5 p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setSearch(searchInput);
          }}
        >
          <div className="flex-1">
            <label htmlFor="product-search" className="form-label text-sm">
              Buscar por SKU o nombre
            </label>
            <input
              id="product-search"
              className="form-control"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Ej. café, LIM-001…"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-brand">
              <i className="bi bi-search me-1" aria-hidden="true" />
              Buscar
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setOffset(0);
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="app-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">
            {loading
              ? "Cargando productos…"
              : `${total} producto(s) · mostrando ${total === 0 ? 0 : offset + 1}–${pageEnd}`}
          </p>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="product-limit" className="text-sm text-[var(--muted)]">
              Por página
            </label>
            <select
              id="product-limit"
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
                <th scope="col">SKU</th>
                <th scope="col">Nombre</th>
                <th scope="col">Categoría</th>
                <th scope="col">Unidad</th>
                <th scope="col" className="text-end">
                  Precio
                </th>
                <th scope="col" className="text-end">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--muted)]">
                    No hay productos que coincidan.
                  </td>
                </tr>
              )}
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="font-mono text-sm">{product.sku}</td>
                  <td className="font-semibold">{product.name}</td>
                  <td>{product.categoryName}</td>
                  <td>{product.unit}</td>
                  <td className="text-end">{formatMoney(product.price)}</td>
                  <td className="text-end">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => openEdit(product)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void deleteProduct(product)}
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
        title={editing ? "Editar producto" : "Nuevo producto"}
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
              form="product-form"
              className="btn btn-brand"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={saveProduct} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="product-sku" className="form-label">
                SKU *
              </label>
              <input
                id="product-sku"
                className="form-control"
                required
                maxLength={40}
                value={form.sku}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sku: event.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="product-name" className="form-label">
                Nombre *
              </label>
              <input
                id="product-name"
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
              <label htmlFor="product-category" className="form-label">
                Categoría (UUID) *
              </label>
              <input
                id="product-category"
                className="form-control"
                required
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                placeholder="55555555-5555-4555-8555-000000000001"
              />
            </div>
            <div>
              <label htmlFor="product-unit" className="form-label">
                Unidad *
              </label>
              <input
                id="product-unit"
                className="form-control"
                required
                maxLength={20}
                value={form.unit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="PIEZA, CAJA, KG…"
              />
            </div>
            <div>
              <label htmlFor="product-price" className="form-label">
                Precio (MXN) *
              </label>
              <input
                id="product-price"
                className="form-control"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
              />
            </div>
          </div>
          <p className="form-text">
            Los UUID de categoría existen en el seed de datos del backend
            (prefijo <code>55555555-5555-4555-8555-</code>). Si escribes uno
            inexistente, el backend responderá con error de validación.
          </p>
        </form>
      </Modal>
    </div>
  );
}
