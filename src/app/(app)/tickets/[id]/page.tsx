"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/components/auth-context";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import {
  canAssignTickets,
  canManageTickets,
  HANDLED_BY_LABELS,
  MESSAGE_ACTION_LABELS,
  MESSAGE_AUTHOR_LABELS,
  TICKET_CHANNEL_LABELS,
  TICKET_SENTIMENT_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TOPIC_LABELS,
} from "@/lib/permissions";
import type {
  ApiResponse,
  TicketDetail,
  TicketMessage,
} from "@/lib/types";

type EditForm = {
  subject: string;
  channel: string;
  orderId: string;
  topic: string;
  sentiment: string;
  requiresHumanReview: boolean;
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    subject: "",
    channel: "PORTAL",
    orderId: "",
    topic: "",
    sentiment: "",
    requiresHumanReview: false,
  });
  const [assignTo, setAssignTo] = useState("");
  const [rating, setRating] = useState("");
  const [messageForm, setMessageForm] = useState({
    author: "EMPLOYEE",
    content: "",
    action: "",
    sources: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailPayload, messagePayload] = await Promise.all([
        apiRequest<ApiResponse<TicketDetail>>(`/api/ticket/${id}`),
        apiRequest<ApiResponse<TicketMessage[]>>(`/api/ticket/${id}/message`),
      ]);
      setTicket(detailPayload.data);
      setMessages(messagePayload.data);
      setRating(detailPayload.data.rating ? String(detailPayload.data.rating) : "");
      setAssignTo(detailPayload.data.assignedToId ?? "");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!user || !canManageTickets(user.role)) return;
    void load();
  }, [load, user]);

  if (!user) return null;
  if (!canManageTickets(user.role)) return <AccessDenied />;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-10 text-center text-[var(--muted)]">
        <span className="spinner-border text-success" aria-hidden="true" />
        <p className="mt-3 text-sm">Cargando ticket…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-3xl">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <Link href="/tickets" className="btn btn-outline-secondary">
          Volver a tickets
        </Link>
      </div>
    );
  }

  function openEdit() {
    if (!ticket) return;
    setEditForm({
      subject: ticket.subject,
      channel: ticket.channel,
      orderId: ticket.orderId ?? "",
      topic: ticket.topic ?? "",
      sentiment: ticket.sentiment ?? "",
      requiresHumanReview: ticket.requiresHumanReview,
    });
    setEditOpen(true);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          subject: editForm.subject.trim(),
          channel: editForm.channel,
          orderId: editForm.orderId.trim() || null,
          topic: editForm.topic || null,
          sentiment: editForm.sentiment || null,
          requiresHumanReview: editForm.requiresHumanReview,
        }),
      });
      setEditOpen(false);
      setSuccess("Ticket actualizado.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setSuccess(`Estado cambiado a ${TICKET_STATUS_LABELS[status] ?? status}.`);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}/assign`, {
        method: "PUT",
        body: JSON.stringify({
          assignedToId: assignTo.trim() || null,
        }),
      });
      setSuccess("Asignación actualizada.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveRating(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}/rating`, {
        method: "PUT",
        body: JSON.stringify({ rating: Number(rating) }),
      });
      setSuccess("Calificación registrada.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}/message`, {
        method: "POST",
        body: JSON.stringify({
          author: messageForm.author,
          content: messageForm.content.trim(),
          action: messageForm.action || null,
          sources: messageForm.sources.trim() || null,
        }),
      });
      setMessageForm({
        author: messageForm.author,
        content: "",
        action: "",
        sources: "",
      });
      setSuccess("Mensaje agregado.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTicket() {
    if (!id) return;
    if (!window.confirm("¿Eliminar este ticket? Esta acción no se puede deshacer."))
      return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/ticket/${id}`, { method: "DELETE" });
      router.push("/tickets");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const allowedStatuses: string[] =
    ticket.status === "OPEN"
      ? ["IN_PROGRESS", "RESOLVED"]
      : ticket.status === "IN_PROGRESS"
        ? ["RESOLVED"]
        : [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3">
        <Link href="/tickets" className="text-sm text-[var(--brand)]">
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Volver a tickets
        </Link>
      </div>

      <PageHeader
        title={ticket.subject}
        description={`Ticket ${ticket.id}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline-brand btn-sm"
              onClick={openEdit}
            >
              <i className="bi bi-pencil me-1" aria-hidden="true" />
              Editar
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => void deleteTicket()}
              disabled={busy}
            >
              <i className="bi bi-trash me-1" aria-hidden="true" />
              Eliminar
            </button>
          </>
        }
      />

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <section className="app-card p-5">
            <h2 className="text-lg font-semibold">Datos del ticket</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold">Estado</dt>
                <dd>
                  <span className="badge text-bg-primary">
                    {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Cliente</dt>
                <dd>{ticket.customerName}</dd>
              </div>
              <div>
                <dt className="font-semibold">Canal</dt>
                <dd>
                  {TICKET_CHANNEL_LABELS[ticket.channel] ?? ticket.channel}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Tema</dt>
                <dd>
                  {ticket.topic
                    ? (TICKET_TOPIC_LABELS[ticket.topic] ?? ticket.topic)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Sentimiento</dt>
                <dd>
                  {ticket.sentiment
                    ? (TICKET_SENTIMENT_LABELS[ticket.sentiment] ??
                      ticket.sentiment)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Atendido por</dt>
                <dd>
                  {HANDLED_BY_LABELS[ticket.handledBy] ?? ticket.handledBy}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Asignado a</dt>
                <dd>{ticket.assignedToName ?? "Sin asignar"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Calificación</dt>
                <dd>{ticket.rating ?? "Sin calificar"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Creado</dt>
                <dd>{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Mensajes</dt>
                <dd>{ticket.messageCount}</dd>
              </div>
              <div>
                <dt className="font-semibold">Requiere revisión humana</dt>
                <dd>{ticket.requiresHumanReview ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Pedido</dt>
                <dd className="break-all">{ticket.orderId ?? "—"}</dd>
              </div>
            </dl>

            {allowedStatuses.length > 0 && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold">Cambiar estado</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allowedStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="btn btn-sm btn-outline-brand"
                      onClick={() => void updateStatus(status)}
                      disabled={busy}
                    >
                      {TICKET_STATUS_LABELS[status] ?? status}
                    </button>
                  ))}
                </div>
                <p className="form-text mt-2">
                  Transiciones válidas: Abierto → En proceso/Resuelto; En
                  proceso → Resuelto.
                </p>
              </div>
            )}
          </section>

          <section className="app-card p-5">
            <h2 className="text-lg font-semibold">Conversación</h2>
            {messages.length === 0 && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Este ticket no tiene mensajes.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-[#f8fafc] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="badge text-bg-light border">
                      {MESSAGE_AUTHOR_LABELS[message.author] ?? message.author}
                    </span>
                    {message.action && (
                      <span className="badge text-bg-light border">
                        {MESSAGE_ACTION_LABELS[message.action] ?? message.action}
                      </span>
                    )}
                    <span>{formatDateTime(message.sentAt)}</span>
                  </div>
                  <p className="message-bubble mt-2 text-sm">
                    {message.content}
                  </p>
                  {message.sources && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Fuentes: {message.sources}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={addMessage} className="mt-5 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-semibold">Agregar mensaje</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="new-author" className="form-label">
                    Autor
                  </label>
                  <select
                    id="new-author"
                    className="form-select"
                    value={messageForm.author}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        author: event.target.value,
                      }))
                    }
                  >
                    {Object.entries(MESSAGE_AUTHOR_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-action" className="form-label">
                    Acción
                  </label>
                  <select
                    id="new-action"
                    className="form-select"
                    value={messageForm.action}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        action: event.target.value,
                      }))
                    }
                  >
                    <option value="">Sin acción</option>
                    {Object.entries(MESSAGE_ACTION_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-sources" className="form-label">
                    Fuentes
                  </label>
                  <input
                    id="new-sources"
                    className="form-control"
                    maxLength={500}
                    value={messageForm.sources}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        sources: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="new-content" className="form-label">
                    Contenido *
                  </label>
                  <textarea
                    id="new-content"
                    className="form-control"
                    rows={3}
                    required
                    maxLength={2000}
                    value={messageForm.content}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-brand mt-3"
                disabled={busy || !messageForm.content.trim()}
              >
                Agregar mensaje
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-5">
          {canAssignTickets(user.role) && (
            <section className="app-card p-5">
              <h2 className="text-lg font-semibold">Asignación</h2>
              <form onSubmit={assign} className="mt-3">
                <label htmlFor="assign-to" className="form-label">
                  Usuario asignado (UUID)
                </label>
                <input
                  id="assign-to"
                  className="form-control"
                  value={assignTo}
                  onChange={(event) => setAssignTo(event.target.value)}
                  placeholder="Vacío para desasignar"
                />
                <button
                  type="submit"
                  className="btn btn-outline-brand mt-3 w-full"
                  disabled={busy}
                >
                  Guardar asignación
                </button>
              </form>
            </section>
          )}

          <section className="app-card p-5">
            <h2 className="text-lg font-semibold">Calificación</h2>
            <form onSubmit={saveRating} className="mt-3">
              <label htmlFor="ticket-rating" className="form-label">
                Puntaje (1 a 5)
              </label>
              <select
                id="ticket-rating"
                className="form-select"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-outline-brand mt-3 w-full"
                disabled={busy || !rating}
              >
                Guardar calificación
              </button>
            </form>
          </section>
        </div>
      </div>

      <Modal
        title="Editar ticket"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="ticket-edit-form"
              className="btn btn-brand"
              disabled={busy}
            >
              Guardar cambios
            </button>
          </>
        }
      >
        <form id="ticket-edit-form" onSubmit={saveEdit} className="grid gap-4">
          <div>
            <label htmlFor="edit-subject" className="form-label">
              Asunto *
            </label>
            <input
              id="edit-subject"
              className="form-control"
              required
              maxLength={200}
              value={editForm.subject}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  subject: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-channel" className="form-label">
                Canal *
              </label>
              <select
                id="edit-channel"
                className="form-select"
                value={editForm.channel}
                onChange={(event) =>
                  setEditForm((current) => ({
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
              <label htmlFor="edit-order" className="form-label">
                Pedido (UUID)
              </label>
              <input
                id="edit-order"
                className="form-control"
                value={editForm.orderId}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    orderId: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label htmlFor="edit-topic" className="form-label">
                Tema
              </label>
              <select
                id="edit-topic"
                className="form-select"
                value={editForm.topic}
                onChange={(event) =>
                  setEditForm((current) => ({
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
              <label htmlFor="edit-sentiment" className="form-label">
                Sentimiento
              </label>
              <select
                id="edit-sentiment"
                className="form-select"
                value={editForm.sentiment}
                onChange={(event) =>
                  setEditForm((current) => ({
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
              id="edit-review"
              className="form-check-input"
              type="checkbox"
              checked={editForm.requiresHumanReview}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  requiresHumanReview: event.target.checked,
                }))
              }
            />
            <label htmlFor="edit-review" className="form-check-label">
              Requiere revisión humana
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
