export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type ErrorBody = {
  detail?: string;
  message?: string;
  title?: string;
  respuesta?: string;
};

export function friendlyError(status: number, backendDetail?: string): string {
  switch (status) {
    case 400:
      return backendDetail || "La solicitud no es válida.";
    case 401:
      return "Tu sesión caducó. Vuelve a iniciar sesión.";
    case 403:
      return "No tienes permiso para esta acción.";
    case 404:
      return backendDetail || "El recurso no existe o caducó.";
    case 409:
      return backendDetail || "La operación entra en conflicto con el estado actual.";
    case 413:
      return "El archivo es demasiado grande.";
    case 415:
      return "Error de programación: falta el tipo de contenido.";
    case 422:
      return backendDetail || "Los datos no pudieron validarse.";
    case 429:
      return "Demasiadas peticiones. Intenta de nuevo en unos minutos.";
    case 502:
      return "El servicio de voz no está disponible. Puedes escribir el mensaje.";
    default:
      return backendDetail || "Ocurrió un error inesperado.";
  }
}

export async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return "";
  try {
    const body = JSON.parse(text) as ErrorBody & { errors?: string[] };
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors.join(". ");
    }
    return body.detail || body.message || body.respuesta || body.title || text;
  } catch {
    return text;
  }
}

export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}`;
  const reason = "expired";
  window.location.href = `/login?reason=${reason}&next=${encodeURIComponent(next)}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Sesión caducada");
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError(response.status, friendlyError(response.status, detail));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
