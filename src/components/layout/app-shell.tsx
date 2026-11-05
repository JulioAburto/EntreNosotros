"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, ChartNoAxesCombined, CircleHelp, Heart, Home, Settings2, Sparkles } from "lucide-react";
import { initializeGame, useGame } from "@/features/game/store";

const navigation = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/jugar", label: "Jugar", icon: Heart },
  { href: "/preguntas", label: "Preguntas", icon: BookHeart },
  { href: "/progreso", label: "Progreso", icon: ChartNoAxesCombined },
  { href: "/configuracion", label: "Ajustes", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, error } = useGame();
  const theme = state?.theme ?? "system";
  useEffect(() => { initializeGame(); }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  return <>
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" href="/" aria-label="Entre Nosotros, inicio"><span className="brand-icon"><Heart size={22} strokeWidth={1.7} /></span><span>entre nosotros<span className="brand-dot">.</span></span></Link>
      <nav className="desktop-nav" aria-label="Navegación principal">{navigation.slice(1).map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}</nav>
      <span className="header-note"><Sparkles size={14} /> Un espacio para los dos</span>
    </div></header>
    <main id="main-content" className="main-container" tabIndex={-1}>
      {error && <div role="alert" className="storage-alert"><CircleHelp size={20} /><div>{error} <Link href="/configuracion">Abrir configuración</Link></div></div>}
      {state ? children : <div className="loading-state" role="status"><Heart className="loading-heart" size={40} /><p>Preparando nuestro espacio…</p></div>}
    </main>
    <footer className="site-footer"><Heart size={13} /><span>Hecho para escucharnos. Sin prisa, sin respuestas perfectas.</span><Link href="/configuracion#privacidad">Privacidad</Link></footer>
    <nav className="mobile-nav" aria-label="Navegación móvil">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={20} strokeWidth={1.7} /><span>{item.label}</span></Link>)}</nav>
  </>;
}
