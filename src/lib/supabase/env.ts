export function parseSupabaseEnv(url: string | undefined, key: string | undefined) {
  if (!url || !key) throw new Error("Falta configurar la URL y la clave pública de Supabase.");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("La URL de Supabase no es válida."); }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Usa la URL base HTTPS del proyecto Supabase.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Usa una clave publishable de Supabase, nunca una clave secreta.");
  }
  return { url: parsed.origin, key };
}

export function getSupabaseEnv() {
  return parseSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
