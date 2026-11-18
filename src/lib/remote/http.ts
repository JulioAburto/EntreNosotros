import "server-only";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export class RequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache" } });
}
export async function authenticatedClient() {
  const client = await createServerSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new RequestError(401, "unauthorized", "Tu sesión venció. Vuelve a entrar.");
  return client;
}
export async function readBody(request: Request) {
  // Next may normalize request.url to an internal host behind a proxy.
  // The browser Origin must match the actual HTTP Host, never a forwarded header.
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    sameOrigin = ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.get("host");
  } catch { /* Missing or opaque Origin is not accepted for mutations. */ }
  if (!sameOrigin) throw new RequestError(403, "forbidden", "Origen no permitido.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError(415, "invalid", "Se requiere JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "invalid", "Faltan datos.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new RequestError(413, "invalid", "El archivo supera 5 MB."); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new RequestError(400, "invalid", "Datos inválidos."); }
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new RequestError(400, "invalid", "Identificador inválido.");
  return value;
}
export function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) throw new RequestError(400, "invalid", "Revisa los campos del formulario.");
  return value.trim();
}
export function rpcError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "40001") throw new RequestError(409, "conflict", "La partida se actualizó. Actualiza para continuar.");
  if (error.code === "42501") throw new RequestError(403, "forbidden", "No tienes permiso o la invitación ya no está disponible.");
  if (["22023", "23514", "23503", "23505"].includes(error.code ?? "")) throw new RequestError(409, "invalid", "La acción no está disponible en el estado actual. Actualiza y revisa los datos.");
  throw new RequestError(503, "unavailable", "No pudimos confirmar la operación. Actualiza antes de reintentar.");
}
export function failure(error: unknown) {
  return error instanceof RequestError
    ? json({ error: error.code, message: error.message }, error.status)
    : json({ error: "unavailable", message: "No pudimos conectar. Inténtalo de nuevo." }, 503);
}
