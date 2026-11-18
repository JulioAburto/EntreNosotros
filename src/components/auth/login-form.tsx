"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, PageHeading } from "@/components/ui/primitives";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage, validEmail, validOtp } from "@/lib/auth/validation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!validEmail(address) || (sent && !validOtp(code))) {
      setError("Revisa el correo y el código de 6 a 8 dígitos."); return;
    }
    setBusy(true); setError("");
    try {
      const client = createBrowserSupabase();
      const result = sent
        ? await client.auth.verifyOtp({ email: address, token: code, type: "email" })
        : await client.auth.signInWithOtp({ email: address });
      if (result.error) setError(authErrorMessage(result.error.code));
      else if (sent) {
        const invitation = /^#[a-f0-9]{64}$/.test(window.location.hash) ? window.location.hash : "";
        router.replace(`/sala${invitation}`); router.refresh();
      }
      else setSent(true);
    } catch { setError("No pudimos conectar. Revisa tu conexión e inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-lg">
    <PageHeading eyebrow="Nuestro espacio compartido" title="Entrar con tu correo">Te enviaremos un código para identificarte. Cada persona usa su propio correo.</PageHeading>
    <form onSubmit={submit} className="panel space-y-5 p-6">
      <label className="block">Correo electrónico<input className="input mt-2" type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>
      {sent && <><p role="status">Si el correo está habilitado, recibirás un código. Revisa también spam.</p><label className="block">Código de acceso<input className="input mt-2" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} pattern="[0-9]{6,8}" value={code} onChange={e => setCode(e.target.value)} /></label></>}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Un momento…" : sent ? "Verificar código" : "Enviar código"}</Button>
      {sent && <Button variant="secondary" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>Cambiar correo o solicitar otro código</Button>}
    </form>
  </section>;
}
