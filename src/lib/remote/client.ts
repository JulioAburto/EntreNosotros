export class RemoteError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export async function remoteRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new RemoteError(result.error ?? "unavailable", result.message ?? "No pudimos completar la operación.");
  return result as T;
}
