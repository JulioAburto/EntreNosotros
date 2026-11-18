"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SessionControls() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><Button variant="secondary" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const { error } = await createBrowserSupabase().auth.signOut({ scope: "local" });
      if (error) setError("No pudimos cerrar la sesión. Inténtalo de nuevo.");
      else window.location.replace("/login");
    } catch { setError("Revisa tu conexión e inténtalo de nuevo."); }
    finally { setBusy(false); }
  }}>{busy ? "Cerrando…" : "Cerrar sesión"}</Button>{error && <p role="alert">{error}</p>}</div>;
}
