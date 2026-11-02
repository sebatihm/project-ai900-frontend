"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { VoiceRecorder } from "@/components/chat/voice-recorder";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { downloadFile } from "@/lib/download";
import { reportPathFromText, toProxyPath } from "@/lib/format";
import type {
  ChatConversation,
  ChatMessage,
  ChatMode,
  ChatResponse,
} from "@/lib/types";

const STORAGE_PREFIX = "ai901_chat_";
const DRAFT_PREFIX = "ai901_draft_";

function emptyConversation(): ChatConversation {
  return { conversationId: null, messages: [] };
}

function loadConversation(mode: ChatMode): ChatConversation {
  if (typeof window === "undefined") return emptyConversation();
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${mode}`);
    if (!raw) return emptyConversation();
    const parsed = JSON.parse(raw) as ChatConversation;
    if (!parsed || !Array.isArray(parsed.messages)) return emptyConversation();
    return {
      conversationId: parsed.conversationId ?? null,
      messages: parsed.messages,
    };
  } catch {
    return emptyConversation();
  }
}

function loadDraft(mode: ChatMode): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(`${DRAFT_PREFIX}${mode}`) ?? "";
}

function makeMessage(
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    text,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

const MODE_COPY: Record<
  ChatMode,
  { title: string; description: string; empty: string; endpoint: string }
> = {
  internal: {
    title: "Chat interno",
    description:
      "Asistente de inventario para personal autenticado. Consulta productos, inventario, pedidos, sucursales, almacenes, crea tickets y genera informes.",
    empty:
      "Pregunta por un producto, el inventario de tu almacén, un pedido, o pide un informe de ventas.",
    endpoint: "/api/chat",
  },
  public: {
    title: "Chat público",
    description:
      "Asistente para clientes. No consulta inventario, no lista pedidos ni permite adjuntar archivos.",
    empty:
      "Pregunta por sucursales, el estado de un pedido con su código, o solicita registrar un ticket.",
    endpoint: "/api/chat/public",
  },
};

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>("internal");
  const [conversations, setConversations] = useState<
    Record<ChatMode, ChatConversation>
  >({
    internal: emptyConversation(),
    public: emptyConversation(),
  });
  const [drafts, setDrafts] = useState<Record<ChatMode, string>>({
    internal: "",
    public: "",
  });
  const [loadingMode, setLoadingMode] = useState<ChatMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationsRef = useRef(conversations);
  const draftsRef = useRef(drafts);

  useEffect(() => {
    const loaded = {
      internal: loadConversation("internal"),
      public: loadConversation("public"),
    };
    conversationsRef.current = loaded;
    setConversations(loaded);
    setDrafts({
      internal: loadDraft("internal"),
      public: loadDraft("public"),
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    conversationsRef.current = conversations;
    if (!hydrated || typeof window === "undefined") return;
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}internal`,
      JSON.stringify(conversations.internal),
    );
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}public`,
      JSON.stringify(conversations.public),
    );
  }, [conversations, hydrated]);

  useEffect(() => {
    draftsRef.current = drafts;
    if (!hydrated || typeof window === "undefined") return;
    window.sessionStorage.setItem(`${DRAFT_PREFIX}internal`, drafts.internal);
    window.sessionStorage.setItem(`${DRAFT_PREFIX}public`, drafts.public);
  }, [drafts, hydrated]);

  const conversation = conversations[mode];
  const draft = drafts[mode];
  const isLoading = loadingMode === mode;

  const lastAssistant = useMemo(() => {
    for (let index = conversation.messages.length - 1; index >= 0; index--) {
      if (conversation.messages[index].role === "assistant") {
        return conversation.messages[index];
      }
    }
    return null;
  }, [conversation.messages]);

  const needsConfirmation = useMemo(() => {
    if (!lastAssistant) return false;
    return /confirm|¿desea|¿deseas|registrar|reg[íi]stralo|procedo|de acuerdo|autorizas/i.test(
      lastAssistant.text,
    );
  }, [lastAssistant]);

  const needsOrderCode = useMemo(() => {
    if (!lastAssistant) return false;
    return /c[oó]digo|n[uú]mero de pedido|c[oó]digo del pedido/i.test(
      lastAssistant.text,
    );
  }, [lastAssistant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation.messages, isLoading]);

  const updateConversation = useCallback(
    (target: ChatMode, updater: (current: ChatConversation) => ChatConversation) => {
      setConversations((current) => {
        const next = {
          ...current,
          [target]: updater(current[target]),
        };
        conversationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || loadingMode) return;

      const targetMode = mode;
      const userMessage = makeMessage("user", text);
      setError(null);
      setNotice(null);
      setDrafts((current) => ({ ...current, [targetMode]: "" }));
      updateConversation(targetMode, (current) => ({
        ...current,
        messages: [...current.messages, userMessage],
      }));
      setLoadingMode(targetMode);

      try {
        const payload = await apiRequest<ChatResponse>(
          MODE_COPY[targetMode].endpoint,
          {
            method: "POST",
            body: JSON.stringify({
              mensaje: text,
              conversationId: conversationsRef.current[targetMode].conversationId,
            }),
          },
        );

        const assistant = makeMessage("assistant", payload.respuesta);
        updateConversation(targetMode, (current) => ({
          conversationId: payload.conversationId ?? current.conversationId,
          messages: [...current.messages, assistant],
        }));
      } catch (caught) {
        updateConversation(targetMode, (current) => ({
          ...current,
          messages: [
            ...current.messages,
            makeMessage("system", errorMessage(caught)),
          ],
        }));
      } finally {
        setLoadingMode(null);
      }
    },
    [loadingMode, mode, updateConversation],
  );

  const sendAudio = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (loadingMode) return;
      const targetMode = mode;
      setError(null);
      setNotice(null);
      setLoadingMode(targetMode);

      const form = new FormData();
      const extension = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4")
          ? "m4a"
          : "webm";
      form.append("audio", blob, `mensaje.${extension}`);
      const conversationId =
        conversationsRef.current[targetMode].conversationId;
      if (conversationId) {
        form.append("conversationId", conversationId);
      }

      try {
        const payload = await apiRequest<ChatResponse>(
          MODE_COPY[targetMode].endpoint,
          { method: "POST", body: form },
        );

        const transcription =
          payload.transcripcion?.trim() ||
          "(no se pudo mostrar la transcripción)";
        const userMessage = makeMessage("user", transcription, {
          voice: true,
          transcription: payload.transcripcion,
        });
        const assistant = makeMessage("assistant", payload.respuesta);
        updateConversation(targetMode, (current) => ({
          conversationId: payload.conversationId ?? current.conversationId,
          messages: [...current.messages, userMessage, assistant],
        }));
      } catch (caught) {
        updateConversation(targetMode, (current) => ({
          ...current,
          messages: [
            ...current.messages,
            makeMessage("system", errorMessage(caught)),
          ],
        }));
      } finally {
        setLoadingMode(null);
      }
    },
    [loadingMode, mode, updateConversation],
  );

  function switchMode(nextMode: ChatMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setCodeInput("");
  }

  function newConversation() {
    updateConversation(mode, () => emptyConversation());
    setDrafts((current) => ({ ...current, [mode]: "" }));
    setCodeInput("");
    setNotice("Nueva conversación iniciada para este modo.");
  }

  function correctTranscription(message: ChatMessage) {
    if (!message.transcription) return;
    setDrafts((current) => ({ ...current, [mode]: message.transcription ?? "" }));
    setNotice(
      "Revisa el texto, corrígelo si hace falta y envíalo como mensaje de texto.",
    );
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleReportDownload(path: string) {
    setError(null);
    try {
      await downloadFile(toProxyPath(path), "informe-ventas.docx");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function sendCode() {
    const code = codeInput.trim();
    if (!code) return;
    setCodeInput("");
    void sendText(code);
  }

  const copy = MODE_COPY[mode];

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-5xl flex-col md:h-[calc(100vh-4rem)]">
      <PageHeader
        title="Chat IA"
        description="Dos asistentes separados: interno con sesión y público para clientes. Cada uno conserva su propio historial y conversationId."
        actions={
          <button
            type="button"
            className="btn btn-outline-brand btn-sm"
            onClick={newConversation}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nueva conversación
          </button>
        }
      />

      <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div
                className="btn-group"
                role="group"
                aria-label="Seleccionar modo de chat"
              >
                <button
                  type="button"
                  className={`btn btn-sm ${
                    mode === "internal" ? "btn-brand" : "btn-outline-brand"
                  }`}
                  onClick={() => switchMode("internal")}
                  aria-pressed={mode === "internal"}
                >
                  <i className="bi bi-building me-1" aria-hidden="true" />
                  Interno
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    mode === "public" ? "btn-brand" : "btn-outline-brand"
                  }`}
                  onClick={() => switchMode("public")}
                  aria-pressed={mode === "public"}
                >
                  <i className="bi bi-people me-1" aria-hidden="true" />
                  Público
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {copy.description}
              </p>
            </div>
            <div className="text-xs text-[var(--muted)] sm:text-right">
              <span className="badge text-bg-light border">
                conversationId: {conversation.conversationId ?? "nuevo"}
              </span>
              <p className="mt-1">
                {conversation.messages.length} mensaje(s) en este modo
              </p>
            </div>
          </div>
        </div>

        <div
          className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f8fafc] px-4 py-5 md:px-6"
          aria-label="Historial de la conversación"
        >
          {conversation.messages.length === 0 && (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-center">
              <i
                className="bi bi-stars text-3xl text-[var(--brand)]"
                aria-hidden="true"
              />
              <p className="mt-3 font-semibold">{copy.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy.empty}</p>
              <p className="mt-3 text-xs text-[var(--muted)]">
                El chat no admite adjuntar fotos ni archivos.
              </p>
            </div>
          )}

          {conversation.messages.map((message) => {
            const reports =
              message.role === "assistant"
                ? reportPathFromText(message.text)
                : [];
            return (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "message-user"
                      : message.role === "assistant"
                        ? "message-assistant text-[var(--foreground)]"
                        : "message-system"
                  }`}
                >
                  {message.role === "assistant" && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                      Asistente
                    </p>
                  )}
                  {message.role === "user" && message.voice && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                      <i className="bi bi-mic-fill me-1" aria-hidden="true" />
                      Mensaje de voz
                    </p>
                  )}
                  <p className="message-bubble">{message.text}</p>

                  {message.role === "user" &&
                    message.voice &&
                    message.transcription && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light mt-2"
                        onClick={() => correctTranscription(message)}
                      >
                        Corregir y enviar como texto
                      </button>
                    )}

                  {reports.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {reports.map((path) => (
                        <div key={path}>
                          <button
                            type="button"
                            className="btn btn-sm btn-brand"
                            onClick={() => void handleReportDownload(path)}
                          >
                            <i
                              className="bi bi-download me-1"
                              aria-hidden="true"
                            />
                            Descargar informe
                          </button>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            El enlace caduca en 15 minutos.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p
                    className={`mt-2 text-[10px] ${
                      message.role === "user"
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start" role="status" aria-live="polite">
              <div className="message-assistant flex items-center gap-2 px-4 py-3 text-sm text-[var(--muted)]">
                <span>
                  <span
                    className="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  />
                </span>
                El asistente está respondiendo…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--border)] bg-white px-4 py-3 md:px-6">
          {error && (
            <div className="alert alert-danger py-2" role="alert">
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
          {notice && (
            <div className="alert alert-info py-2" role="status">
              <div className="flex items-start justify-between gap-3">
                <span>{notice}</span>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar aviso"
                  onClick={() => setNotice(null)}
                />
              </div>
            </div>
          )}

          {needsConfirmation && !isLoading && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[#f8fafc] p-3">
              <span className="text-sm text-[var(--muted)]">
                ¿Confirmas la acción?
              </span>
              <button
                type="button"
                className="btn btn-sm btn-brand"
                onClick={() => void sendText("Sí, regístralo")}
              >
                Sí, regístralo
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => void sendText("No")}
              >
                No
              </button>
            </div>
          )}

          {needsOrderCode && !isLoading && (
            <div className="mb-3 rounded-xl border border-[var(--border)] bg-[#f8fafc] p-3">
              <label htmlFor="order-code" className="form-label text-sm">
                Código de pedido escrito a mano
              </label>
              <div className="flex gap-2">
                <input
                  id="order-code"
                  className="form-control"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder="TST-ORD-20260905-0003"
                  maxLength={50}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendCode();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-brand"
                  onClick={sendCode}
                  disabled={!codeInput.trim()}
                >
                  Enviar código
                </button>
              </div>
              <p className="form-text mt-1">
                Los códigos dictados se transcriben mal; escríbelo para evitar
                errores.
              </p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Escribe tu mensaje
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              className="form-control min-h-[52px] resize-none"
              rows={2}
              value={draft}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [mode]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendText(draft);
                }
              }}
              placeholder={
                isLoading
                  ? "Espera la respuesta del asistente…"
                  : "Escribe tu mensaje. Enter para enviar, Shift+Enter para salto de línea."
              }
              disabled={isLoading}
            />
            <VoiceRecorder
              disabled={isLoading}
              onAudio={sendAudio}
              onError={(message) => setError(message)}
            />
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => void sendText(draft)}
              disabled={isLoading || !draft.trim()}
              aria-label="Enviar mensaje"
            >
              {isLoading ? (
                <span
                  className="spinner-border spinner-border-sm"
                  aria-hidden="true"
                />
              ) : (
                <i className="bi bi-send" aria-hidden="true" />
              )}
            </button>
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            {mode === "public"
              ? "Modo público: sin inventario, listado de pedidos ni adjuntos."
              : "El asistente usa el rol de tu sesión; el backend valida todo."}{" "}
            El audio se corta automáticamente a los 60 segundos.
          </p>

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {lastAssistant ? `Nueva respuesta: ${lastAssistant.text}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
