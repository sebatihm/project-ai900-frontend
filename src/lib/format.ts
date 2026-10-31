export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function reportPathFromText(text: string): string[] {
  const matches = text.match(/\/report\/download\/[A-Za-z0-9-]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function toProxyPath(backendPath: string): string {
  if (backendPath.startsWith("/api/")) return backendPath;
  if (backendPath.startsWith("/")) return `/api${backendPath}`;
  return `/api/${backendPath}`;
}
