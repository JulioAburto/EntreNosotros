"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, PageHeading } from "@/components/ui/primitives";
import { remoteRequest, RemoteError } from "@/lib/remote/client";
import type { Lobby } from "@/features/remote/types";

export function RoomLobby() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("Nuestra partida");
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState("");
  const creatingId = useRef<string | null>(null);
  const mounted = useRef(true);
  async function refresh(signal?: AbortSignal) {
    const value = await remoteRequest<Lobby>("/api/games", undefined, signal);
    if (mounted.current) setLobby(value);
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const fragment = window.location.hash.slice(1);
    if (/^[a-f0-9]{64}$/.test(fragment)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    remoteRequest<Lobby>("/api/games", undefined, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setLobby(value);
      if (/^[a-f0-9]{64}$/.test(fragment)) setToken(fragment);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No pudimos cargar tus salas."); });
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  async function act(body?: unknown) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (body) {
        const result = await remoteRequest<{ token?: string }>("/api/games", body);
        if (result.token && mounted.current) setInvitation(`${window.location.origin}/sala#${result.token}`);
      }
      await refresh();
    } catch (error) {
      if (error instanceof RemoteError && error.code === "unauthorized") { setLobby(null); window.location.replace("/login"); }
      if (mounted.current) setError(error instanceof Error ? error.message : "Revisa tu conexión.");
    } finally { if (mounted.current) setBusy(false); }
  }
  return <section className="space-y-6">
    <PageHeading eyebrow="Juntos desde dos dispositivos" title="Nuestra sala">Los cambios aparecen al actualizar. El progreso local sigue separado hasta que decidan importarlo.</PageHeading>
    <Button disabled={busy} variant="secondary" onClick={() => act()}>Actualizar salas</Button>
    {busy && <p role="status">Guardando o consultando…</p>}{error && <p role="alert">{error}</p>}
    {lobby?.games.map(game => <article className="panel space-y-3 p-6" key={game.id}>
      <h2>{game.name}</h2><p>Tu nombre en esta sala: {game.displayName}</p>
      <Link className="button button-primary" href={`/sala/${game.id}`}>Abrir partida</Link>
      {game.position === 0 && <div className="flex flex-wrap gap-3"><Button disabled={busy} variant="secondary" onClick={() => act({ action: "invite", gameId: game.id })}>Crear invitación</Button><Button disabled={busy} variant="ghost" onClick={() => { setInvitation(""); void act({ action: "revoke", gameId: game.id }); }}>Revocar invitaciones</Button></div>}
    </article>)}
    {invitation && <div className="panel space-y-3 p-6"><label className="block">Enlace de invitación (vence en 24 horas)<input className="input mt-2" readOnly value={invitation} onFocus={e => e.target.select()} /></label><p>Comparte este enlace con tu pareja. Luego aprueba su solicitud. Crear otra invitación revoca la anterior.</p></div>}
    {lobby?.requests.map(request => <article className="panel space-y-3 p-6" key={request.id}>
      <p>{request.mine ? "Tu solicitud" : `Solicitud de ${request.displayName}`}: {request.revoked ? "invitación revocada" : request.expired ? "invitación vencida" : ({ pending: "pendiente", approved: "aprobada", rejected: "rechazada" }[request.status])}</p>
      {!request.mine && request.status === "pending" && !request.expired && !request.revoked && <div className="flex gap-3"><Button disabled={busy} onClick={() => act({ action: "decide", gameId: request.gameId, requestId: request.id, approve: true })}>Aprobar</Button><Button disabled={busy} variant="secondary" onClick={() => act({ action: "decide", gameId: request.gameId, requestId: request.id, approve: false })}>Rechazar</Button></div>}
    </article>)}
    <div className="panel space-y-5 p-6"><label className="block">Tu nombre visible<input className="input mt-2" value={displayName} maxLength={30} onChange={e => setDisplayName(e.target.value)} /></label>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); creatingId.current ??= crypto.randomUUID(); void act({ action: "create", id: creatingId.current, name, displayName }); }}><label className="block">Nombre de la nueva sala<input className="input mt-2" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label><Button type="submit" disabled={busy || !displayName.trim()}>Crear sala</Button></form>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act({ action: "join", token: token.includes("#") ? token.split("#").at(-1) : token, displayName }); }}><label className="block">Enlace o código de invitación<input className="input mt-2" required value={token} maxLength={500} onChange={e => setToken(e.target.value)} /></label><Button type="submit" variant="secondary" disabled={busy || !displayName.trim()}>Solicitar ingreso</Button></form>
    </div>
  </section>;
}
