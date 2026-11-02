"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/components/auth-context";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import {
  canManageTickets,
  HANDLED_BY_LABELS,
  TICKET_CHANNEL_LABELS,
  TICKET_SENTIMENT_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TOPIC_LABELS,
} from "@/lib/permissions";
import type {
  ApiResponse,
  CustomerSummary,
  OrderSummary,
  PaginatedResponse,
  TicketSummary,
} from "@/lib/types";

type TicketForm = {
  customerId: string;
  orderId: string;
  subject: string;
  channel: string;
  topic: string;
  sentiment: string;
  handledBy: string;
  requiresHumanReview: boolean;
  messageAuthor: string;
  messageContent: string;
};

const EMPTY_FORM: TicketForm = {
  customerId: "",
  orderId: "",
  subject: "",
  channel: "PORTAL",
  topic: "",
  sentiment: "",
  handledBy: "HUMAN",
  requiresHumanReview: false,
  messageAuthor: "CUSTOMER",
  messageContent: "",
};

export default function TicketsPage() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TicketForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    return params.toString();
  }, [offset, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<
        ApiResponse<PaginatedResponse<TicketSummary>>
      >(`/api/ticket?${query}`);
      setTickets(payload.data.items);
      setTotal(payload.data.total);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!user || !canManageTickets(user.role)) return;
    void load();
  }, [load, user]);

  useEffect(() => {
    if (!user || !canManageTickets(user.role)) return;
    let active = true;
    setReferencesLoading(true);
    Promise.all([
      apiRequest<ApiResponse<PaginatedResponse<CustomerSummary>>>(
        "/api/customer?offset=0&limit=100",
      ),
      apiRequest<ApiResponse<PaginatedResponse<OrderSummary>>>(
        "/api/order?offset=0&limit=100",
      ),
    ])
      .then(([customerPayload, orderPayload]) => {
        if (!active) return;
        setCustomers(customerPayload.data.items);
        setOrders(orderPayload.data.items);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setReferencesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (!canManageTickets(user.role)) return <AccessDenied />;

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        customerId: form.customerId.trim(),
        subject: form.subject.trim(),
        channel: form.channel,
        handledBy: form.handledBy,
        requiresHumanReview: form.requiresHumanReview,
      };
      if (form.orderId.trim()) body.orderId = form.orderId.trim();
      if (form.topic) body.topic = form.topic;
      if (form.sentiment) body.sentiment = form.sentiment;
      if (form.messageContent.trim()) {
        body.initialMessage = {
          author: form.messageAuthor,
          content: form.messageContent.trim(),
        };
      }

      await apiRequest("/api/ticket", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setOffset(0);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const pageEnd = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tickets de soporte"
        description="Consulta, crea y da seguimiento a las solicitudes de ayuda de tus clientes."
        actions={
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setModalOpen(true);
            }}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nuevo ticket
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
              ? "Cargando tickets…"
              : `${total} ticket(s) · mostrando ${total === 0 ? 0 : offset + 1}–${pageEnd}`}
          </p>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="limit" className="text-sm text-[var(--muted)]">
              Por página
            </label>
            <select
              id="limit"
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
                <th scope="col">Asunto</th>
                <th scope="col">Cliente</th>
                <th scope="col">Estado</th>
                <th scope="col">Tema</th>
                <th scope="col">Canal</th>
                <th scope="col">Asignado</th>
                <th scope="col">Creado</th>
                <th scope="col" className="text-end">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                    No hay solicitudes de soporte disponibles.
                  </td>
                </tr>
              )}
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold">{ticket.subject}</span>
                      {ticket.requiresHumanReview && (
                        <span className="badge text-bg-warning mt-1 w-fit">
                          Atención especial
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{ticket.customerName}</td>
                  <td>
                    <span
                      className={`badge ${
                        ticket.status === "OPEN"
                          ? "text-bg-primary"
                          : ticket.status === "IN_PROGRESS"
                            ? "text-bg-info"
                            : "text-bg-success"
                      }`}
                    >
                      {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </td>
                  <td>
                    {ticket.topic
                      ? (TICKET_TOPIC_LABELS[ticket.topic] ?? ticket.topic)
                      : "—"}
                  </td>
                  <td>
                    {TICKET_CHANNEL_LABELS[ticket.channel] ?? ticket.channel}
                  </td>
                  <td>{ticket.assignedToName ?? "Sin asignar"}</td>
                  <td>{formatDateTime(ticket.createdAt)}</td>
                  <td className="text-end">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="btn btn-sm btn-outline-brand"
                    >
                      Ver detalle
                    </Link>
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
            disabled={!hasPrev || loading}
            onClick={() => setOffset(Math.max(offset - limit, 0))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!hasNext || loading}
            onClick={() => setOffset(offset + limit)}
          >
            Siguiente
          </button>
        </div>
      </section>

      <Modal
        title="Nuevo ticket"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
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
              form="ticket-create-form"
              className="btn btn-brand"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Crear ticket"}
            </button>
          </>
        }
      >
        <form id="ticket-create-form" onSubmit={createTicket} className="grid gap-4">
          <div>
            <label htmlFor="ticket-customer" className="form-label">
              Cliente relacionado *
            </label>
            <select
              id="ticket-customer"
              className="form-select"
              required
              value={form.customerId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                }))
              }
              disabled={referencesLoading}
            >
              <option value="">
                {referencesLoading ? "Cargando clientes…" : "Selecciona un cliente"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ticket-subject" className="form-label">
                Asunto *
              </label>
              <input
                id="ticket-subject"
                className="form-control"
                required
                maxLength={200}
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label htmlFor="ticket-order" className="form-label">
                Pedido relacionado (opcional)
              </label>
              <select
                id="ticket-order"
                className="form-select"
                value={form.orderId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    orderId: event.target.value,
                  }))
                }
                disabled={referencesLoading}
              >
                <option value="">
                  {referencesLoading ? "Cargando pedidos…" : "Sin pedido relacionado"}
                </option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.code} — {order.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-channel" className="form-label">
                Canal *
              </label>
              <select
                id="ticket-channel"
                className="form-select"
                value={form.channel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channel: event.target.value,
                  }))
                }
              >
                {Object.entries(TICKET_CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-handled" className="form-label">
                Atendido por
              </label>
              <select
                id="ticket-handled"
                className="form-select"
                value={form.handledBy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    handledBy: event.target.value,
                  }))
                }
              >
                {Object.entries(HANDLED_BY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-topic" className="form-label">
                Tema
              </label>
              <select
                id="ticket-topic"
                className="form-select"
                value={form.topic}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    topic: event.target.value,
                  }))
                }
              >
                <option value="">Sin tema</option>
                {Object.entries(TICKET_TOPIC_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-sentiment" className="form-label">
                Sentimiento
              </label>
              <select
                id="ticket-sentiment"
                className="form-select"
                value={form.sentiment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sentiment: event.target.value,
                  }))
                }
              >
                <option value="">Sin sentimiento</option>
                {Object.entries(TICKET_SENTIMENT_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="form-check">
            <input
              id="ticket-review"
              className="form-check-input"
              type="checkbox"
              checked={form.requiresHumanReview}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  requiresHumanReview: event.target.checked,
                }))
              }
            />
            <label htmlFor="ticket-review" className="form-check-label">
              Requiere revisión humana
            </label>
          </div>

          <fieldset className="rounded-xl border border-[var(--border)] p-4">
            <legend className="float-none w-auto px-1 text-sm font-semibold">
              Mensaje inicial (opcional)
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="message-author" className="form-label">
                  Autor
                </label>
                <select
                  id="message-author"
                  className="form-select"
                  value={form.messageAuthor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      messageAuthor: event.target.value,
                    }))
                  }
                >
                  <option value="CUSTOMER">Cliente</option>
                  <option value="EMPLOYEE">Empleado</option>
                  <option value="AGENT">Agente</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="message-content" className="form-label">
                  Contenido
                </label>
                <textarea
                  id="message-content"
                  className="form-control"
                  rows={3}
                  maxLength={2000}
                  value={form.messageContent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      messageContent: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
