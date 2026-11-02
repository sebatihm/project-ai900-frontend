import type { RoleName } from "@/lib/types";

export const ROLE_LABELS: Record<RoleName, string> = {
  BOSS: "Dirección general",
  ADMIN: "Administración",
  BRANCH_MANAGER: "Gerente de sucursal",
  WAREHOUSE_HEAD: "Jefe de almacén",
  ADMIN_SUPPORT: "Soporte administrativo",
};

export const ROLE_NAMES: Record<RoleName, string> = {
  BOSS: "BOSS",
  ADMIN: "ADMIN",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  WAREHOUSE_HEAD: "WAREHOUSE_HEAD",
  ADMIN_SUPPORT: "ADMIN_SUPPORT",
};

export function canGenerateReports(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "BRANCH_MANAGER"].includes(role);
}

export function canManageTickets(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "ADMIN_SUPPORT", "BRANCH_MANAGER"].includes(role);
}

export function canManageProducts(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "WAREHOUSE_HEAD"].includes(role);
}

export function canAnalyzeInvoices(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "ADMIN_SUPPORT"].includes(role);
}

export function canManageSuppliers(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "ADMIN_SUPPORT", "BRANCH_MANAGER"].includes(role);
}

export function canAssignTickets(role: RoleName): boolean {
  return ["ADMIN", "BOSS", "ADMIN_SUPPORT", "BRANCH_MANAGER"].includes(role);
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelto",
};

export const TICKET_CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Correo",
  VOICE: "Voz",
  PORTAL: "Portal",
};

export const TICKET_TOPIC_LABELS: Record<string, string> = {
  DELAY: "Retraso",
  INVOICE: "Factura",
  DAMAGED_PRODUCT: "Producto dañado",
  CANCELLATION: "Cancelación",
  BILLING: "Facturación",
  OTHER: "Otro",
};

export const TICKET_SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positivo",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negativo",
};

export const HANDLED_BY_LABELS: Record<string, string> = {
  AGENT: "Agente",
  HUMAN: "Humano",
};

export const MESSAGE_AUTHOR_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  EMPLOYEE: "Empleado",
  AGENT: "Agente",
};

export const MESSAGE_ACTION_LABELS: Record<string, string> = {
  CONSULT_ORDER: "Consultar pedido",
  SEARCH_POLICY: "Buscar política",
  CREATE_TICKET: "Crear ticket",
  ESCALATE: "Escalar",
};
