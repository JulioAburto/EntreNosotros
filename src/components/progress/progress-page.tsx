"use client";

import Link from "next/link";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { useGame } from "@/features/game/store";
import { getProgress } from "@/features/game/rules";
import { CategoryBadge, PageHeading, ProgressBar } from "@/components/ui/primitives";

export function ProgressPage() {
  const { state, sessionCompleted } = useGame();
  if (!state) return null;
  const progress = getProgress(state);
  const answered = sessionCompleted.filter(id => state.completed[id]).length;
  return <><PageHeading eyebrow="TODO LO QUE VAMOS CONSTRUYENDO" title="Nuestro camino juntos">No se trata de terminar. Se trata de seguir descubriéndonos.</PageHeading><section className="progress-hero panel"><div className="progress-ring" style={{ background: `conic-gradient(var(--accent) ${progress.percentage * 3.6}deg, var(--track) 0deg)` }}><div><Heart size={23} /><strong>{progress.percentage}%</strong><span>compartido</span></div></div><div><p className="eyebrow">UNA CONVERSACIÓN A LA VEZ</p><h2>{progress.completed ? "Más cerca que ayer" : "Una historia por descubrir"}</h2><p className="muted">{progress.completed} preguntas completadas de {progress.total}.</p><Link href="/jugar" className="button button-primary mt-5">Sigamos conversando <ArrowRight size={17} /></Link></div></section><section className="stats-grid" aria-label="Estadísticas"><article className="panel"><span>Total de preguntas</span><strong>{progress.total}</strong></article><article className="panel"><span>Completadas</span><strong>{progress.completed}</strong></article><article className="panel"><span>Pendientes</span><strong>{progress.pending}</strong></article><article className="panel"><span>En esta sesión</span><strong>{answered}</strong></article></section><div className="session-note"><Sparkles size={18} /><p>El próximo turno es de <strong>{state.players[state.currentPlayer]}</strong>. La sesión cuenta las preguntas completadas desde la ruleta en esta visita.</p></div><section className="category-progress"><h2>Un poquito de cada parte de nosotros</h2><p className="muted mb-6">Incluye todas las preguntas, también las desactivadas.</p><div className="category-progress-grid">{state.categories.map(category => { const item = getProgress(state, category.id); return <article className="panel" key={category.id}><CategoryBadge category={category} /><div className="flex justify-between gap-3 my-4"><span>{item.completed} de {item.total} compartidas</span><strong>{item.percentage}%</strong></div><ProgressBar value={item.percentage} label={`Progreso de ${category.name}`} /></article>; })}</div></section></>;
}
