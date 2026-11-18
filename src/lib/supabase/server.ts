import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "./env";

export async function createServerSupabase() {
  const { url, key } = getSupabaseEnv();
  const jar = await cookies();
  return createServerClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy refreshes the session. */ }
      },
    },
  });
}

export async function requireUser() {
  const client = await createServerSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
}
