"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { remoteRequest, RemoteError } from "@/lib/remote/client";
import type { CommandEnvelope, GameCommand, RemoteSnapshot } from "./types";

export function useRemoteGame(gameId: string) {
  const [snapshot, setSnapshot] = useState<RemoteSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "conflict" | "error">("loading");
  const [message, setMessage] = useState("");
  const [retryAvailable, setRetryAvailable] = useState(false);
  const pending = useRef<CommandEnvelope | null>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await remoteRequest<RemoteSnapshot>(`/api/games/${gameId}`, undefined, signal);
    if (!signal.aborted) setSnapshot(previous => !previous || previous.gameId !== gameId || data.revision >= previous.revision ? data : previous);
    return data;
  }, [gameId]);
  const report = useCallback((error: unknown) => {
    if (error instanceof RemoteError && ["unauthorized", "not_found", "forbidden"].includes(error.code)) {
      setSnapshot(null);
      if (error.code === "unauthorized") window.location.replace("/login");
    }
    setStatus(error instanceof RemoteError && error.code === "conflict" ? "conflict" : "error");
    setMessage(error instanceof Error ? error.message : "No pudimos conectar. Actualiza antes de reintentar.");
  }, []);
  useEffect(() => {
    const current = new AbortController(); controller.current = current;
    remoteRequest<RemoteSnapshot>(`/api/games/${gameId}`, undefined, current.signal).then(data => {
      if (!current.signal.aborted) { setSnapshot(data); setStatus("ready"); }
    }).catch(error => { if (!current.signal.aborted) report(error); });
    return () => { current.abort(); pending.current = null; };
  }, [gameId, report]);
  async function refresh() {
    if (busy.current || !controller.current) return;
    busy.current = true; setStatus("loading"); setMessage("");
    const signal = controller.current.signal;
    try { await load(signal); if (!signal.aborted) setStatus("ready"); }
    catch (error) { if (!signal.aborted) report(error); }
    finally { busy.current = false; }
  }
  async function execute(command?: GameCommand) {
    if (busy.current || !snapshot || !controller.current) return false;
    if (command && pending.current) return false;
    const envelope = command ? { ...command, commandId: crypto.randomUUID(), revision: snapshot.revision } : pending.current;
    if (!envelope) return false;
    pending.current = envelope; busy.current = true; setStatus("saving"); setMessage("");
    const signal = controller.current.signal;
    try {
      if (!command) await load(signal); // Reconcile before replay, preserving the original ID and revision.
      const result = await remoteRequest<{ status: string }>(`/api/games/${gameId}`, envelope, signal);
      pending.current = null; setRetryAvailable(false);
      await load(signal);
      if (!signal.aborted) { setStatus("ready"); setMessage(result.status === "no_eligible" ? "No quedan preguntas elegibles. Revisa filtros o recupera las saltadas." : "Guardado."); }
      return true;
    } catch (error) {
      if (!signal.aborted) {
        if (error instanceof RemoteError && error.code !== "unavailable") pending.current = null;
        setRetryAvailable(Boolean(pending.current)); report(error);
      }
      return false;
    } finally { busy.current = false; }
  }
  return { snapshot, status, message, retryAvailable, refresh, execute };
}
