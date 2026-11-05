"use client";

import { useState, type FormEvent } from "react";
import { gameActions, useGame } from "@/features/game/store";
import { Button, Dialog } from "@/components/ui/primitives";
import type { Player, Question } from "@/types";

export function RecipientForm({ question, onClose }: { question: Question; onClose: () => void }) {
  const { state } = useGame();
  const [recipient, setRecipient] = useState(question.intendedResponder === undefined ? "" : String(question.intendedResponder));
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    try { if (gameActions.setRecipient(question.id, recipient === "" ? undefined : Number(recipient) as Player)) onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar el destinatario."); }
  }
  return <Dialog title={`Destinatario de la pregunta ${question.number}`} onClose={onClose}><form className="form-stack" onSubmit={submit}><p className="muted">Algunos textos están escritos específicamente para Naza. Ustedes deciden si corresponde asignar una persona; el texto y el progreso no cambian.</p><label>Quién puede responder<select value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Sin destinatario asignado</option>{state?.players.map((name, index) => <option key={index} value={index}>Solo {name}</option>)}</select></label><p className="gentle-note">Cuando asignas una persona, esta pregunta solo aparece cuando le toca responder. Sin asignación, sigue las reglas generales del turno.</p>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit">Guardar destinatario</Button></form></Dialog>;
}
