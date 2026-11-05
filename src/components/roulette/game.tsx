"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Heart, RotateCw, Shuffle, SlidersHorizontal } from "lucide-react";
import { gameActions, useGame } from "@/features/game/store";
import { eligibleQuestions, getProgress, turnParticipants } from "@/features/game/rules";
import { Button, CategoryBadge, PageHeading } from "@/components/ui/primitives";
import { CategoryFilters } from "./category-filters";
import type { Player } from "@/types";

export function Game() {
  const { state, skipped, blocked, sessionCompleted } = useGame();
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);
  const card = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const selected = state?.questions.find(question => question.id === state.activeQuestionId);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId && !spinning) {
      card.current?.focus({ preventScroll: true });
      card.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [selectedId, spinning]);
  if (!state) return null;
  const eligible = eligibleQuestions(state, skipped);
  const paused = new Set([...skipped, ...(state.lastSkippedId ? [state.lastSkippedId] : [])]);
  const progress = getProgress(state);
  const { asker, responder } = turnParticipants(state);
  const isFirst = progress.completed === 0 && !selected && paused.size === 0 && sessionCompleted.length === 0;

  function spin() {
    if (lock.current || blocked) return;
    lock.current = true;
    const result = gameActions.spin();
    if (!result) { lock.current = false; return; }
    setSpinning(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => { setSpinning(false); lock.current = false; }, reducedMotion ? 0 : 1_500);
  }

  return <div className="game-page">
    <PageHeading eyebrow="UN MOMENTO PARA NOSOTROS" title="Que el azar nos acerque">Uno pregunta, el otro responde. Todo el tiempo del mundo.</PageHeading>
    <div className="game-toolbar">
      <p className="turn-indicator" aria-live="polite"><span className="turn-avatar">{asker.slice(0, 1)}</span><span><strong>{asker}</strong> pregunta</span><span className="turn-arrow" aria-hidden="true">→</span><span><strong>{responder}</strong> responde</span></p>
      <Button variant="ghost" disabled={spinning || blocked || Boolean(selected)} onClick={gameActions.changeTurn}><Shuffle size={16} />Cambiar turno</Button>
    </div>
    {isFirst && <fieldset className="starter-choice" disabled={blocked}><legend>¿Quién pregunta primero?</legend>{state.players.map((player, index) => <label key={index}><input type="radio" name="first-player" checked={state.currentPlayer === index} onChange={() => gameActions.newGame(index as Player, false)} />{player}</label>)}</fieldset>}
    <div className="game-grid">
      <section className="roulette-stage" aria-label="Ruleta de preguntas">
        <div className={"roulette-orbit " + (spinning ? "is-spinning" : "")}><div className="roulette-inner"><span className="eyebrow">{spinning ? "UN POQUITO DE AZAR" : selected ? "TU PREGUNTA" : "NUESTRA PRÓXIMA"}</span>{spinning ? <Heart size={45} className="spin-heart" /> : selected ? <strong className="roulette-number">{selected.number}</strong> : <span className="roulette-question">?</span>}<span>{spinning ? "Eligiendo…" : "conversación"}</span></div><span className="orbit-heart"><Heart size={20} fill="currentColor" /></span></div>
        <Button onClick={spin} disabled={spinning || blocked || Boolean(selected) || !eligible.length} className="spin-button"><RotateCw size={19} className={spinning ? "rotating" : ""} />{spinning ? "Girando…" : selected ? "Pregunta en conversación" : "Girar la ruleta"}</Button>
        <p className="muted" role="status">{spinning ? "Preparando su pregunta" : selected ? "Completen o salten la pregunta para volver a girar." : eligible.length + " preguntas disponibles para este turno"}</p>
      </section>
      {selected && !spinning ? <section className="question-card active-question-card" aria-label="Pregunta seleccionada">
        <div className="question-card-top"><CategoryBadge category={state.categories.find(category => category.id === selected.categoryId)} /><span className="question-number">N.º {selected.number}</span></div>
        <p className="respondent-caption">Esta pregunta la responde <strong>{responder}</strong></p>
        <h2 ref={card} tabIndex={-1}>{selected.text}</h2>
        <p className="muted">{asker} pregunta y {responder} responde. Solo responde {responder}, con calma y sin presiones.</p>
        <p className="gentle-note">El texto original se conserva. Si no corresponde a quien responde, pueden saltarlo o asignar un destinatario desde el administrador.</p>
        <div className="question-actions"><Button onClick={gameActions.complete} disabled={blocked}><Check size={18} />{responder} ya respondió</Button><Button variant="secondary" onClick={gameActions.skip} disabled={blocked}>Saltar por ahora</Button></div>
      </section> : <section className="question-card question-placeholder">
        <Heart size={48} strokeWidth={1} /><h2>{spinning ? "Una nueva historia por contar…" : eligible.length ? "Las mejores conversaciones empiezan con una pregunta." : progress.pending === 0 ? "¡Cuánto hemos compartido!" : "Un respiro también cuenta"}</h2>
        <p>{spinning ? "El azar está preparando este momento." : eligible.length ? "En cada turno, uno pregunta y el otro responde. No hay respuestas incorrectas ni obligación de contestar." : "No hay preguntas elegibles para este turno. Pueden recuperar las saltadas, cambiar de turno, activar categorías o agregar preguntas."}</p>
        {!eligible.length && !spinning && <Link className="button button-secondary" href="/administrar">Administrar preguntas</Link>}
      </section>}
    </div>
    {paused.size > 0 && <div className="skipped-note"><span>{paused.size} pregunta(s) en pausa.</span><Button variant="ghost" disabled={spinning || blocked} onClick={gameActions.recoverSkipped}>Recuperar preguntas saltadas</Button></div>}
    <details className="panel filter-disclosure"><summary><SlidersHorizontal size={18} /><span>El ambiente de hoy</span><span className="muted">{state.enabledCategoryIds.length} categorías</span><ChevronDown size={17} /></summary><div className="filter-content"><fieldset disabled={spinning || Boolean(selected)}><legend className="sr-only">Filtros de juego</legend>{selected && <p className="gentle-note mb-3">Completa o salta la pregunta actual para cambiar las categorías.</p>}<CategoryFilters /></fieldset></div></details>
    <p className="game-reminder"><Heart size={14} /> Pueden saltar cualquier pregunta. Estar cómodos va primero.</p>
  </div>;
}
