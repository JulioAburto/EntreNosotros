"use client";

import Link from "next/link";
import { ArrowRight, BookHeart, Heart, Infinity as InfinityIcon, LockKeyhole, MessageCircleHeart, Sparkles } from "lucide-react";
import { useGame } from "@/features/game/store";
import { getProgress } from "@/features/game/rules";
import { ProgressBar } from "@/components/ui/primitives";

export function Home() {
  const { state } = useGame();
  if (!state) return null;
  const progress = getProgress(state);
  return <div className="home-page">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="tiny-line" /> PARA SEGUIR ELIGIÉNDONOS</p>
        <h1>Entre Nosotros <span className="sr-only">❤️</span><br /><em>un poquito más cerca.</em></h1>
        <p className="hero-description">{progress.total} preguntas, infinitas maneras de enamorarnos.<br className="hidden sm:block" /> Un momento para pausar el mundo y volver a nosotros.</p>
        <div className="couple"><div className="avatar-pair"><span>{state.players[0].slice(0, 1).toLocaleUpperCase()}</span><span>{state.players[1].slice(0, 1).toLocaleUpperCase()}</span></div><div><strong>{state.players[0]} <span className="ampersand">&</span> {state.players[1]}</strong><span className="couple-caption">Nuestra historia sigue creciendo</span></div></div>
        <Link className="button button-primary hero-button" href="/jugar">{state.activeQuestionId ? "Continuar nuestra conversación" : "Comenzar a jugar"}<ArrowRight size={19} /></Link>
        <p className="hero-footnote"><LockKeyhole size={13} /> Sin cuentas. Solo ustedes y este momento.</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><span className="art-spark spark-one">✧</span><span className="art-spark spark-two">✦</span>
        <div className="memory-card card-back"><span>lo que somos</span><Heart size={76} strokeWidth={0.8} /></div>
        <div className="memory-card card-front"><span className="card-kicker">NUESTRA PRÓXIMA CONVERSACIÓN</span><div className="heart-seal"><Heart size={54} strokeWidth={1.1} /></div><p>Siempre hay algo<br /><em>bonito por descubrir.</em></p><span className="card-bottom">TÚ, YO Y UN POQUITO DE AZAR</span></div>
        <div className="floating-note"><MessageCircleHeart size={17} /> Que nunca dejemos de conocernos</div>
      </div>
    </section>
    <section className="home-progress panel"><div className="progress-intro"><span className="soft-icon"><BookHeart size={24} /></span><div><p className="eyebrow">NUESTRO CAMINO</p><h2>Cada conversación cuenta</h2><p className="muted">{progress.completed === 0 ? "Las mejores historias empiezan con una pregunta." : "Miren todo lo que ya han compartido."}</p></div></div><div className="home-progress-meter"><div className="flex justify-between gap-3"><span><strong>{progress.completed}</strong> de {progress.total} completadas</span><strong>{progress.percentage}%</strong></div><ProgressBar value={progress.percentage} label="Progreso general" /><Link href="/progreso">Ver nuestro progreso <ArrowRight size={14} /></Link></div></section>
    <section className="ritual-section"><p className="eyebrow text-center">UN PEQUEÑO RITUAL, UNA GRAN CONEXIÓN</p><div className="ritual-grid">
      <article><span className="step-number">01</span><Heart size={22} /><h3>Dejen que el azar elija</h3><p>Giren la ruleta y descubran una pregunta para este momento.</p></article>
      <article><span className="step-number">02</span><MessageCircleHeart size={22} /><h3>Escúchense de verdad</h3><p>Sin reloj ni respuestas correctas. El regalo es estar presentes.</p></article>
      <article><span className="step-number">03</span><InfinityIcon size={24} /><h3>Sigan creando su historia</h3><p>Guarden su progreso y vuelvan cuando quieran conectar.</p></article>
    </div></section>
    <p className="home-quote"><Sparkles size={16} /> «El amor también se construye en las pequeñas conversaciones.»</p>
  </div>;
}
