// Calls to the backend. They go through /api on this site (see next.config.ts),
// so the admin session cookie belongs to the shop's own domain.

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; field?: string } = {},
  ) {
    super(body.error ?? `HTTP ${status}`);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type AdminUser = { email: string };

export const adminLogin = (email: string, password: string) =>
  api<AdminUser>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const adminLogout = () => api<void>("/admin/logout", { method: "POST" });

export const adminMe = () => api<AdminUser>("/admin/me");

/** Name of the cookie the backend sets; only its presence is checked here. */
export const SESSION_COOKIE = "aisha_session";
