"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Search, Settings2 } from "lucide-react";
import { gameActions, useGame } from "@/features/game/store";
import { Button, CategoryBadge, PageHeading } from "@/components/ui/primitives";
import type { Question } from "@/types";

export function QuestionList({ manage = false, onEdit, onDelete, onRecipient }: { manage?: boolean; onEdit?: (question: Question) => void; onDelete?: (question: Question) => void; onRecipient?: (question: Question) => void }) {
  const { state, blocked } = useGame();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(30);
  const filtered = useMemo(() => state?.questions.filter(question => {
    const completed = Boolean(state.completed[question.id]);
    const matchesStatus = status === "all" || (status === "completed" && completed) || (status === "pending" && !completed) || (status === "custom" && question.source === "custom") || (status === "inactive" && !question.isActive);
    return question.text.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es").trim()) && (!category || question.categoryId === category) && matchesStatus;
  }) ?? [], [state, search, category, status]);
  if (!state) return null;
  return <>
    <div className="question-filters"><label className="search-input"><Search size={18} /><span className="sr-only">Buscar por texto</span><input type="search" placeholder="Buscar una pregunta, un recuerdo…" value={search} onChange={event => { setSearch(event.target.value); setLimit(30); }} /></label><label><span className="sr-only">Filtrar por categoría</span><select value={category} onChange={event => { setCategory(event.target.value); setLimit(30); }}><option value="">Todas las categorías</option>{state.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Filtrar por estado</span><select value={status} onChange={event => { setStatus(event.target.value); setLimit(30); }}><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="completed">Completadas</option><option value="inactive">Desactivadas</option><option value="custom">Personalizadas</option></select></label></div>
    <p className="result-count" role="status">{filtered.length} de {state.questions.length} preguntas · Mostrando {Math.min(limit, filtered.length)}</p>
    <div className="question-list">{filtered.slice(0, limit).map(question => {
      const completed = Boolean(state.completed[question.id]);
      return <article className={`question-row ${completed ? "is-completed" : ""}`} key={question.id}>
        {!manage && <input type="checkbox" className="completion-checkbox" aria-label={`Completar pregunta ${question.number}`} checked={completed} disabled={blocked} onChange={event => gameActions.setCompleted(question.id, event.target.checked)} />}
        <span className="list-question-number">{String(question.number).padStart(2, "0")}</span><div className="question-row-body"><div className="flex flex-wrap items-center gap-x-3 gap-y-2"><CategoryBadge category={state.categories.find(item => item.id === question.categoryId)} />{completed && <span className="status-label"><Check size={12} />Completada</span>}{!question.isActive && <span className="status-label">Desactivada</span>}{question.source === "custom" && <span className="status-label">Personalizada</span>}</div><p>{question.text}</p>
        {question.intendedResponder !== undefined && <p className="gentle-note">Destinatario: {state.players[question.intendedResponder]}</p>}{manage && <div className="manage-row-actions"><Button variant="ghost" onClick={() => onRecipient?.(question)} disabled={blocked || state.activeQuestionId === question.id}>Destinatario</Button><label className="inline-checkbox"><input type="checkbox" checked={question.isActive} disabled={blocked} onChange={event => gameActions.setActive(question.id, event.target.checked)} />Activa en la ruleta</label>{question.source === "custom" ? <><Button variant="ghost" onClick={() => onEdit?.(question)} disabled={blocked || state.activeQuestionId === question.id} aria-label={`Editar pregunta ${question.number}`}>Editar</Button><Button variant="ghost" className="danger-text" onClick={() => onDelete?.(question)} disabled={blocked || state.activeQuestionId === question.id} aria-label={`Eliminar pregunta ${question.number}`}>Eliminar</Button></> : <span className="muted text-xs">Original · contenido protegido</span>}</div>}</div>
        </article>;
    })}</div>
    {!filtered.length && <div className="empty-state panel"><Search size={25} /><h2>No encontramos esa pregunta</h2><p>Prueba con otro texto o cambia los filtros.</p></div>}
    {filtered.length > limit && <div className="text-center mt-6"><Button variant="secondary" onClick={() => setLimit(current => current + 30)}>Mostrar más preguntas</Button></div>}
  </>;
}

export function QuestionsPage() {
  return <><div className="page-heading-row"><PageHeading eyebrow="NUESTRO ÁLBUM DE CONVERSACIONES" title="Todas las preguntas">Las que ya nos acercaron y las que todavía nos esperan.</PageHeading><Link href="/administrar" className="button button-secondary"><Settings2 size={17} />Administrar preguntas</Link></div><div className="gentle-note flex items-start gap-2 mb-6"><Plus size={16} className="shrink-0 mt-0.5" /><p>Marcar aquí la pregunta en conversación completa su turno; las demás no cambian el turno. Desmarcar vuelve a habilitar una pregunta si coincide con los filtros y el destinatario.</p></div><QuestionList /></>;
}
