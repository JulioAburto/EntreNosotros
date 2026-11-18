"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createBrowserSupabase() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
