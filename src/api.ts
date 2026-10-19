export type Role =
  | "admin"
  | "staff"
  | "affiliate"
  | "publisher"
  | "advertiser"
  | "platform_admin";
export interface User {
  id: string;
  email: string;
  role: Role;
  name?: string;
  api_enabled?: boolean;
  staff_permissions?: string[] | null;
  parent_user_id?: string;
}
export interface Session {
  access_token: string;
  csrf_token: string;
  user: User;
}
export type Row = Record<string, any>;
export class ApiError extends Error {
  status: number;
  requestId?: string;
  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
let session: Session | null = null;
let refreshFlight: Promise<Session | null> | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export function currentSession() {
  return session;
}
export function onSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setSession(value: Session | null) {
  session = value;
  listeners.forEach((fn) => fn());
}
function errorMessage(body: Row) {
  const detail = body.detail;
  return Array.isArray(detail)
    ? detail
        .map(
          (d: Row) =>
            `${(d.loc || []).filter((x: string) => x !== "body").join(" → ")}: ${d.msg}`,
        )
        .join("; ")
    : typeof detail === "string"
      ? detail
      : "The request could not be completed.";
}
async function raw(path: string, init: RequestInit = {}) {
  return fetch(base + path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}
async function checked(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorMessage(body),
      response.headers.get("X-Request-ID") || undefined,
    );
  }
  return response;
}
export async function refresh() {
  if (refreshFlight) return refreshFlight;
  const at = revision;
  const run = async () => {
    const csrfResponse = await raw("/auth/csrf");
    if (csrfResponse.status === 401 || csrfResponse.status === 403) return null;
    await checked(csrfResponse);
    const { csrf_token } = await csrfResponse.json();
    const response = await raw("/auth/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf_token },
    });
    if (response.status === 401 || response.status === 403) return null;
    await checked(response);
    return response.json() as Promise<Session>;
  };
  refreshFlight = (async () => {
    const next = navigator.locks
      ? await navigator.locks.request("relay-session-refresh", run)
      : await run();
    if (at === revision) setSession(next);
    return at === revision ? next : null;
  })().finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}
export async function api<T = Row>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = session?.access_token;
  let response = await raw(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && token && retry) {
    if (await refresh()) return api<T>(path, init, false);
    setSession(null);
  }
  response = await checked(response);
  return response.status === 204 ? (undefined as T) : response.json();
}
export const send = <T = Row>(path: string, body?: unknown, method = "POST") =>
  api<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
export async function login(email: string, password: string) {
  const result = await send<Session>("/auth/login", { email, password });
  revision++;
  setSession(result);
  return result;
}
export async function endSession(all = false) {
  if (!session) return;
  const perform = async () => {
    const csrfResponse = await checked(await raw("/auth/csrf"));
    const { csrf_token } = await csrfResponse.json();
    return raw(all ? "/auth/logout-all" : "/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
        "X-CSRF-Token": csrf_token,
      },
    });
  };
  let response = navigator.locks
    ? await navigator.locks.request("relay-session-refresh", perform)
    : await perform();
  if (response.status === 401 && all && (await refresh()))
    response = navigator.locks
      ? await navigator.locks.request("relay-session-refresh", perform)
      : await perform();
  await checked(response);
  revision++;
  setSession(null);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("relay-session");
    channel.postMessage("logout");
    channel.close();
  }
}
if (typeof BroadcastChannel !== "undefined") {
  const channel = new BroadcastChannel("relay-session");
  channel.onmessage = (event) => {
    if (event.data === "logout") {
      revision++;
      setSession(null);
    }
  };
}
export function query(values: Row) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== "" && v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export async function download(path: string, filename: string) {
  if (!session) throw new ApiError(401, "Please sign in again.");
  let response = await raw(path, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (response.status === 401 && (await refresh()))
    response = await raw(path, {
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
  await checked(response);
  const truncated = response.headers.get("X-Export-Truncated") === "true";
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return truncated;
}
