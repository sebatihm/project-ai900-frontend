"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/components/auth-context";
import {
  canAnalyzeInvoices,
  canGenerateReports,
  canManageProducts,
  canManageTickets,
  ROLE_LABELS,
} from "@/lib/permissions";
import type { RoleName } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  visible: (role: RoleName) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/chat",
    label: "Chat IA",
    icon: "bi-chat-dots",
    visible: () => true,
  },
  {
    href: "/reports",
    label: "Informes",
    icon: "bi-file-earmark-bar-graph",
    visible: canGenerateReports,
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: "bi-ticket-detailed",
    visible: canManageTickets,
  },
  {
    href: "/products",
    label: "Productos",
    icon: "bi-box-seam",
    visible: canManageProducts,
  },
  {
    href: "/invoices",
    label: "Facturas",
    icon: "bi-receipt-cutoff",
    visible: canAnalyzeInvoices,
  },
];

function ShellContent({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-[var(--muted)]">
          <span className="spinner-border text-success" aria-hidden="true" />
          <p className="mt-3 text-sm">Cargando sesión…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="app-card w-full max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Sesión no disponible</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Vuelve a iniciar sesión para continuar.
          </p>
          <a className="btn btn-brand mt-5" href="/login">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.visible(user.role));

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[var(--brand-dark)] p-5 text-white md:flex">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Río Claro
          </p>
          <h1 className="mt-2 text-xl font-bold">Asistente IA</h1>
          <p className="mt-1 text-xs text-emerald-100/70">
            Panel de demostración
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación principal">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link-brand flex items-center gap-3 px-3 py-2 text-sm ${
                  active ? "active" : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-xl bg-white/10 p-3 text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-emerald-100/80">
            {ROLE_LABELS[user.role]}
          </p>
          {user.warehouseName && (
            <p className="mt-1 text-xs text-emerald-100/70">
              {user.warehouseName}
            </p>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-light mt-3 w-full"
            onClick={() => void logout()}
          >
            <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">
                Río Claro
              </p>
              <p className="text-sm font-semibold">{user.name}</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => void logout()}
              aria-label="Cerrar sesión"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
            </button>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto px-3 pb-3"
            aria-label="Navegación principal"
          >
            {visibleItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <i className={`bi ${item.icon} me-1`} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
