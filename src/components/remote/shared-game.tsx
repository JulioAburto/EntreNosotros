"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Heart, RotateCw } from "lucide-react";
import { Button, CategoryBadge, ConfirmDialog, PageHeading, ProgressBar } from "@/components/ui/primitives";
import { useRemoteGame } from "@/features/remote/use-remote-game";
import { RemoteImportPanel } from "./import-panel";
import { RemoteQuestionEditor } from "./question-editor";
import type { GameCommand, RemoteQuestion } from "@/features/remote/types";

export function SharedGame({ gameId }: { gameId: string }) {
  const { snapshot: s, status, message, retryAvailable, refresh, execute } = useRemoteGame(gameId);
  const [editing, setEditing] = useState<RemoteQuestion | "new" | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; command: GameCommand } | null>(null);
  const [search, setSearch] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [limit, setLimit] = useState(30);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#8f365c");
  const card = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (s?.activeQuestionId) card.current?.focus({ preventScroll: true }); }, [s?.activeQuestionId]);
  const busy = status === "loading" || status === "saving";
  const disabled = busy || retryAvailable || status !== "ready";
  if (!s) return <section><PageHeading eyebrow="Partida compartida" title="Nuestro espacio" /><p role={status === "error" ? "alert" : "status"}>{message || "Consultando partida…"}</p><Button disabled={busy} onClick={refresh}>Actualizar partida</Button><Link href="/sala">Volver a las salas</Link></section>;
  const asker = s.members.find(m => m.id === s.currentMemberId);
  const responder = s.members.find(m => m.id !== s.currentMemberId);
  const asking = s.viewerMemberId === asker?.id;
  const answering = s.viewerMemberId === responder?.id;
  const selected = s.questions.find(q => q.id === s.activeQuestionId);
  const completed = new Set(s.completions.map(c => c.question_id));
  const eligible = s.questions.filter(q => q.is_active && s.enabledCategoryIds.includes(q.category_id) && !completed.has(q.id) && !s.skippedQuestionIds.includes(q.id) && q.id !== s.lastSkippedQuestionId && (!q.intended_responder_member_id || q.intended_responder_member_id === responder?.id));
  const filtered = s.questions.filter(q => `${q.number} ${q.text}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="game-page space-y-6">
    <PageHeading eyebrow="UN MOMENTO PARA NOSOTROS" title={s.name}>Cada pregunta la responde una sola persona. No guardamos respuestas.</PageHeading>
    <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={busy} onClick={refresh}>Actualizar partida</Button><Link href="/sala">Salas e invitaciones</Link></div>
    <p className="muted">Esta es la última vista consultada. Actualiza para ver los cambios de tu pareja.</p>
    {message && <p role={status === "error" || status === "conflict" ? "alert" : "status"}>{message}</p>}
    {busy && <p role="status">{status === "saving" ? "Guardando…" : "Consultando…"}</p>}
    {retryAvailable && <Button disabled={busy} onClick={() => execute()}>Consultar y reintentar la misma acción</Button>}
    {!responder ? <div className="panel p-6"><h2>Esperando a tu pareja</h2><p>Crea una invitación desde Salas, aprueba su solicitud y actualiza esta partida para comenzar.</p></div> : <>
      <div className="game-toolbar"><p className="turn-indicator" aria-live="polite"><strong>{asker?.displayName}</strong> pregunta → <strong>{responder.displayName}</strong> responde</p><Button variant="ghost" disabled={disabled || !asking || Boolean(selected)} onClick={() => execute({ action: "turn", memberId: responder.id })}>Cambiar turno</Button></div>
      <p className="respondent-caption">{asking ? `Vos preguntás — ${responder.displayName} responde` : "Te toca responder"}</p>
      <div id="juego" className="game-grid"><section className="roulette-stage" aria-label="Ruleta de preguntas"><div className="roulette-orbit"><div className="roulette-inner"><span className="eyebrow">{selected ? "TU PREGUNTA" : "NUESTRA PRÓXIMA"}</span>{selected ? <strong className="roulette-number">{selected.number}</strong> : <span className="roulette-question">?</span>}<span>conversación</span></div><span className="orbit-heart"><Heart size={20} fill="currentColor" /></span></div>
        <Button className="spin-button" disabled={disabled || !asking || Boolean(selected) || eligible.length === 0} onClick={() => execute({ action: "reserve" })}><RotateCw size={19} />Girar la ruleta</Button><p className="muted">{eligible.length} preguntas disponibles para este turno</p></section>
        {selected ? <section className="question-card active-question-card" aria-label="Pregunta seleccionada"><div className="question-card-top"><CategoryBadge category={s.categories.find(c => c.id === selected.category_id)} /><span>N.º {selected.number}</span></div><p>Esta pregunta la responde <strong>{responder.displayName}</strong></p><h2 ref={card} tabIndex={-1}>{selected.text}</h2><div className="question-actions"><Button disabled={disabled || !answering} onClick={() => execute({ action: "complete", questionId: selected.id })}>{responder.displayName} ya respondió</Button><Button variant="secondary" disabled={disabled || !asking} onClick={() => execute({ action: "skip", questionId: selected.id })}>Saltar por ahora</Button></div></section> : <section className="question-card question-placeholder"><Heart size={48} /><h2>{asking ? "Una nueva conversación nos espera" : "Tu pareja elige la próxima pregunta"}</h2><p>Actualiza después de que tu pareja guarde una acción.</p></section>}
      </div>
      {s.skippedQuestionIds.length > 0 && <Button variant="ghost" disabled={disabled} onClick={() => execute({ action: "recover_skipped" })}>Recuperar preguntas saltadas ({s.skippedQuestionIds.length})</Button>}
      <details className="panel p-6"><summary>Categorías de esta partida</summary><fieldset disabled={disabled || Boolean(selected)} className="mt-4 space-y-3"><legend className="sr-only">Categorías habilitadas</legend>{s.categories.map(c => <label className="block" key={c.id}><input type="checkbox" checked={s.enabledCategoryIds.includes(c.id)} onChange={e => execute({ action: "settings", categoryIds: e.target.checked ? [...s.enabledCategoryIds, c.id] : s.enabledCategoryIds.filter(id => id !== c.id) })} /> {c.name}</label>)}</fieldset></details>
    </>}
    <section id="progreso" className="panel space-y-4 p-6"><h2>Nuestro progreso</h2><p>{completed.size} de {s.questions.length} preguntas completadas</p><ProgressBar label="Progreso compartido" value={s.questions.length ? Math.round(completed.size / s.questions.length * 100) : 0} />{s.categories.map(c => { const qs = s.questions.filter(q => q.category_id === c.id); return <p key={c.id}>{c.name}: {qs.filter(q => completed.has(q.id)).length} / {qs.length}</p>; })}</section>
    <details id="preguntas" className="panel space-y-4 p-6"><summary>Preguntas y administración</summary><Button disabled={disabled || !responder} onClick={() => setEditing("new")}>Crear pregunta</Button><label className="block">Buscar pregunta<input className="input" value={search} onChange={e => { setSearch(e.target.value); setLimit(30); }} /></label>
      {filtered.slice(0, limit).map(q => <article className="question-card space-y-3" key={q.id}><p><strong>{q.number}.</strong> {q.text}</p><p className="muted">{q.is_active ? "Activa" : "Desactivada"} · {q.intended_responder_member_id ? `Responde ${s.members.find(m => m.id === q.intended_responder_member_id)?.displayName}` : "Sin destinatario asignado"}</p><div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={disabled || !responder || (q.id === s.activeQuestionId && !answering)} onClick={() => execute({ action: completed.has(q.id) ? "uncomplete" : "mark_complete", questionId: q.id })}>{completed.has(q.id) ? "Desmarcar" : "Marcar completada"}</Button><Button variant="ghost" disabled={disabled || !responder || q.id === s.activeQuestionId} onClick={() => setEditing(q)}>Editar</Button>{q.source === "custom" && <Button variant="danger" disabled={disabled || q.id === s.activeQuestionId} onClick={() => setConfirmation({ title: "¿Eliminar esta pregunta y su progreso?", command: { action: "delete_question", questionId: q.id } })}>Eliminar</Button>}</div></article>)}
      {filtered.length > limit && <Button variant="secondary" onClick={() => setLimit(limit + 30)}>Mostrar más</Button>}
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await execute({ action: "add_category", id: `category-${crypto.randomUUID()}`, name: categoryName, color: categoryColor })) setCategoryName(""); }}><h3>Crear categoría</h3><label className="block">Nombre<input className="input" required maxLength={80} value={categoryName} onChange={e => setCategoryName(e.target.value)} /></label><label>Color <input type="color" value={categoryColor} onChange={e => setCategoryColor(e.target.value)} /></label><Button type="submit" disabled={disabled || !responder}>Guardar categoría</Button></form>
    </details>
    {asking && responder && <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={disabled} onClick={() => setConfirmation({ title: "¿Iniciar otra ronda conservando el progreso?", command: { action: "reset", memberId: asker.id, clearProgress: false } })}>Nueva ronda</Button><Button variant="danger" disabled={disabled} onClick={() => setConfirmation({ title: "¿Borrar el progreso de ambos? Las preguntas se conservarán.", command: { action: "reset", memberId: asker.id, clearProgress: true } })}>Reiniciar progreso</Button></div>}
    <section id="ajustes" className="panel space-y-4 p-6"><h2>Tu nombre en esta sala</h2><form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await execute({ action: "profile", name: displayName })) setDisplayName(""); }}><label className="block">Nombre visible<input className="input" required maxLength={30} placeholder={s.members.find(m => m.id === s.viewerMemberId)?.displayName} value={displayName} onChange={e => setDisplayName(e.target.value)} /></label><Button type="submit" disabled={disabled}>Guardar mi nombre</Button></form><Link href="/">Abrir modo local para respaldar datos anteriores</Link></section>
    <RemoteImportPanel snapshot={s} disabled={disabled} execute={execute} />
    {editing && <RemoteQuestionEditor snapshot={s} question={editing === "new" ? undefined : editing} busy={disabled} execute={execute} close={() => setEditing(null)} />}
    {confirmation && <ConfirmDialog title={confirmation.title} onClose={() => setConfirmation(null)} onConfirm={async () => { if (await execute(confirmation.command)) setConfirmation(null); }}>Esta acción afecta la partida compartida.</ConfirmDialog>}
  </div>;
}
