"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError, readErrorDetail } from "@/lib/client-api";
import type { ApiResponse, LoginResponse } from "@/lib/types";

type LoginState = {
  next: string;
  reason: string | null;
};

function safeNext(value: string | null): string {
  if (!value) return "/chat";
  if (!value.startsWith("/") || value.startsWith("//")) return "/chat";
  if (value.startsWith("/login")) return "/chat";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<LoginState>({
    next: "/chat",
    reason: null,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setState({
      next: safeNext(params.get("next")),
      reason: params.get("reason"),
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        setError(friendlyError(response.status, detail));
        return;
      }

      const payload = (await response.json()) as ApiResponse<LoginResponse>;
      if (!payload.data?.token) {
        setError("La respuesta del servidor no incluyó una sesión válida.");
        return;
      }
      router.replace(state.next);
    } catch {
      setError("No se pudo iniciar sesión. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-xl md:grid-cols-[1.05fr_1fr]">
        <section className="hidden flex-col justify-between bg-[var(--brand-dark)] p-10 text-white md:flex">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">
              Río Claro
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              Asistente de inventario y ventas con IA
            </h1>
            <p className="mt-4 max-w-sm text-sm text-emerald-50/90">
              Consulta productos, pedidos e inventario, crea tickets de soporte
              y genera informes de ventas en Word desde un solo lugar.
            </p>
          </div>
          <div className="mt-10 space-y-3 text-sm text-emerald-50/90">
            <p className="flex items-center gap-2">
              <i className="bi bi-shield-lock" aria-hidden="true" />
              El token se guarda en una cookie HttpOnly y nunca llega al
              navegador.
            </p>
            <p className="flex items-center gap-2">
              <i className="bi bi-mic" aria-hidden="true" />
              Chat por texto o voz en español, con transcripción visible.
            </p>
            <p className="flex items-center gap-2">
              <i className="bi bi-file-earmark-word" aria-hidden="true" />
              Informes de ventas descargables por 15 minutos.
            </p>
          </div>
        </section>

        <section className="p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">
              Acceso
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              Inicia sesión
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Todas las vistas requieren una sesión activa.
            </p>
          </div>

          {state.reason === "expired" && (
            <div className="alert alert-warning" role="alert">
              Tu sesión caducó. Vuelve a iniciar sesión para continuar.
            </div>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="form-label">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@ai901.local"
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="form-control pr-12"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-[var(--muted)]"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  <i
                    className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-brand w-full py-2.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-[var(--border)] bg-[#f8fafc] p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--foreground)]">
              Credenciales de demostración
            </p>
            <p className="mt-1">
              <code>admin@ai901.local</code> / <code>Admin@123</code>
            </p>
            <p className="mt-1">
              Usuarios por rol (tras ejecutar el seed de demo):{" "}
              <code>demo.boss@ai901.local</code>,{" "}
              <code>demo.admin@ai901.local</code>,{" "}
              <code>demo.branch@ai901.local</code>,{" "}
              <code>demo.warehouse@ai901.local</code>,{" "}
              <code>demo.support@ai901.local</code>. Contraseña:{" "}
              <code>Demo@1234</code>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
