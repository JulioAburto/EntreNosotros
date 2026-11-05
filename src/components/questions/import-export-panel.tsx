"use client";

import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { gameActions, useGame } from "@/features/game/store";
import { downloadFile, mergeBank, parseImport, toBackup, toBank, type ImportDocument } from "@/lib/import-export";
import { MAX_IMPORT_BYTES } from "@/lib/validation/schema";
import { Button, ConfirmDialog } from "@/components/ui/primitives";

export function ImportExportPanel() {
  const { state, blocked } = useGame();
  const [document, setDocument] = useState<ImportDocument | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"merge" | "restore">("merge");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!state) return null;
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !state) return;
    setError(""); setMessage(""); setDocument(null); setBusy(true); setMode("merge");
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("El archivo supera el límite de 5 MB.");
      const parsed = parseImport(await file.text(), file.name, state.categories);
      setDocument(parsed);
      setFileName(file.name);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo leer el archivo."); }
    finally { setBusy(false); }
  }
  function importData() {
    if (!document) return;
    try {
      if (mode === "restore" && document.restoredState) {
        gameActions.restore(document.restoredState);
        setMessage("Respaldo restaurado. Se recuperaron las preguntas, el progreso y la configuración.");
      } else {
        const result = gameActions.merge(document.bank);
        setMessage(`${result.added} preguntas agregadas; ${result.skipped} duplicadas omitidas. Tu progreso se conserva.`);
      }
      setDocument(null);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo importar."); }
    setConfirm(false);
  }
  let preview = "";
  if (document && mode === "merge") {
    try { const result = mergeBank(state, document.bank); preview = `${result.added} nuevas · ${result.skipped} duplicadas se omitirán`; }
    catch (error) { preview = error instanceof Error ? error.message : "No se puede fusionar este archivo."; }
  }
  return <section className="panel transfer-panel"><div><p className="eyebrow">CUIDEMOS NUESTRA HISTORIA</p><h2>Importar y respaldar</h2><p className="muted mt-2">Todo vive en este navegador. Un respaldo completo permite recuperar su progreso en otro dispositivo.</p></div><div className="export-buttons"><Button variant="secondary" onClick={() => downloadFile("entre-nosotros-preguntas.json", JSON.stringify(toBank(state), null, 2))}><Download size={17} />Exportar banco JSON</Button><Button variant="secondary" onClick={() => downloadFile("entre-nosotros-respaldo.json", JSON.stringify(toBackup(state), null, 2))}><Download size={17} />Respaldo completo</Button></div>
    <label className={`upload-area ${blocked ? "is-disabled" : ""}`}><Upload size={24} /><strong>{busy ? "Validando archivo…" : "Importar un archivo JSON o CSV"}</strong><span>Hasta 5 MB. Primero revisamos el contenido; nada cambia al elegir un archivo.</span><input type="file" accept=".json,.csv,application/json,text/csv" aria-label="Importar archivo de preguntas o respaldo" onChange={readFile} disabled={blocked || busy} /></label>
    {document && <div className="import-preview"><strong>{fileName}</strong><p>{document.bank.questions.length} preguntas en el archivo.</p><fieldset className="flex flex-wrap gap-4 my-4"><legend className="sr-only">Modo de importación</legend><label className="inline-checkbox"><input type="radio" name="import-mode" checked={mode === "merge"} onChange={() => setMode("merge")} />Fusionar</label><label className="inline-checkbox"><input type="radio" name="import-mode" checked={mode === "restore"} disabled={!document.restoredState} onChange={() => setMode("restore")} />Restaurar respaldo</label></fieldset><p className="muted mb-4">{mode === "merge" ? `${preview}. Conserva el progreso y las preguntas actuales. Los números nuevos se asignan consecutivamente.` : "Reemplaza la partida actual por el respaldo: banco, categorías, progreso, turno y configuración."}</p>{!document.restoredState && <p className="muted mb-4">Restaurar requiere un respaldo completo, no un banco o CSV.</p>}<Button disabled={blocked} onClick={() => mode === "restore" ? setConfirm(true) : importData()}>{mode === "merge" ? "Fusionar preguntas" : "Restaurar respaldo"}</Button></div>}
    {message && <p role="status" className="success-message">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {confirm && <ConfirmDialog title="¿Restaurar esta historia?" confirmLabel="Reemplazar y restaurar" onClose={() => setConfirm(false)} onConfirm={importData}>Se reemplazarán los datos actuales. Exporta un respaldo completo antes de continuar si quieres conservarlos.</ConfirmDialog>}
    <details className="import-help"><summary>Cómo preparar un archivo</summary><p>Para JSON, exporta el banco y usa su estructura: format, version, categories y questions. Los IDs deben ser únicos. Los originales son de solo lectura.</p><p>CSV UTF-8: columnas obligatorias <code>text,categoryId</code>. Opcionales: <code>id,number,isActive,createdAt,source</code>. Usa comillas dobles para textos con comas o saltos de línea. Crea las categorías antes de importar.</p><p>IDs de categorías disponibles: {state.categories.map(category => category.id).join(", ")}</p><a href="/ejemplo-preguntas.csv" download>Descargar ejemplo CSV (pregunta de ejemplo, no original)</a></details>
  </section>;
}
