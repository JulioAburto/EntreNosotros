"use client";

import { useState } from "react";
import { gameActions, useGame } from "@/features/game/store";
import { LEGACY_STORAGE_KEY, migrateLegacy } from "@/lib/import-export/legacy";
import { Button, ConfirmDialog } from "@/components/ui/primitives";
import type { GameState } from "@/types";

export function LegacyImport() {
  const { blocked } = useGame();
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function validate(raw: string) {
    setError(""); setMessage("");
    try { setPreview(migrateLegacy(JSON.parse(raw))); }
    catch (error) { setError(error instanceof SyntaxError ? "El contenido no es JSON válido." : error instanceof Error ? error.message : "No se pudo leer el progreso antiguo."); }
  }
  return <details className="panel legacy-panel"><summary>Traer mi progreso del HTML original</summary><div className="legacy-content"><p className="muted">Abre el HTML en el navegador donde jugaban. En las herramientas de desarrollo, busca Almacenamiento → Local Storage y copia el valor de <code>{LEGACY_STORAGE_KEY}</code>. Pégalo aquí o guárdalo como JSON e impórtalo arriba.</p><p className="muted">Un archivo local, localhost y Vercel tienen almacenamientos distintos. Solo podemos leer automáticamente la clave si está en este mismo origen.</p><label className="form-stack">JSON del progreso anterior<textarea rows={5} maxLength={100_000} value={content} onChange={event => setContent(event.target.value)} placeholder={'{"completed": [1, 2], "enabledCategories": [1, 2, 3], …}'} /></label><div className="flex flex-wrap gap-3 mt-4"><Button disabled={blocked || !content.trim()} onClick={() => validate(content)}>Validar progreso antiguo</Button><Button variant="secondary" disabled={blocked} onClick={() => { try { const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY); if (!raw) setError("No hay datos del HTML en este origen. Copia el JSON desde el navegador y la ubicación originales."); else validate(raw); } catch { setError("El navegador no permite leer el almacenamiento anterior."); } }}>Buscar en este navegador y origen</Button></div>{error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="success-message">{message}</p>}</div>{preview && <ConfirmDialog title="¿Restaurar el progreso del HTML?" confirmLabel="Restaurar progreso antiguo" onClose={() => setPreview(null)} onConfirm={() => { try { gameActions.restore(preview); setMessage("Progreso antiguo restaurado con sus filtros, turno, pregunta activa y última pregunta saltada."); setPreview(null); } catch (error) { setError(error instanceof Error ? error.message : "No se pudo restaurar."); setPreview(null); } }}>{Object.keys(preview.completed).length} preguntas completadas y {preview.enabledCategoryIds.length} categorías activas. Se reemplazará la partida actual; descarga un respaldo antes. La clave original del HTML no se modifica.</ConfirmDialog>}</details>;
}
