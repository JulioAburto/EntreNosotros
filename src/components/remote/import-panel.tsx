"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { downloadFile, parseImport, toBackup, type ImportDocument } from "@/lib/import-export";
import { portableState } from "@/features/remote/backup";
import type { GameCommand, RemoteSnapshot } from "@/features/remote/types";

export function RemoteImportPanel({ snapshot, disabled, execute }: { snapshot: RemoteSnapshot; disabled: boolean; execute: (command: GameCommand) => Promise<boolean> }) {
  const [preview, setPreview] = useState<ImportDocument | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const creator = snapshot.members.find(m => m.position === 0)?.id === snapshot.viewerMemberId;
  return <details className="panel space-y-4 p-6"><summary>Respaldos e importación</summary>
    <p>Descarga un respaldo antes de hacer cambios. Importar nunca borra el almacenamiento local.</p>
    <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={disabled || snapshot.members.length !== 2} onClick={() => {
      try { downloadFile("entre-nosotros-respaldo.json", JSON.stringify(toBackup(portableState(snapshot)), null, 2)); }
      catch (error) { setError(error instanceof Error ? error.message : "No pudimos exportar."); }
    }}>Exportar respaldo portable</Button><Button variant="secondary" disabled={disabled} onClick={() => downloadFile("entre-nosotros-snapshot-remoto.json", JSON.stringify({ format: "entre-nosotros-shared-snapshot", version: 1, exportedAt: new Date().toISOString(), snapshot }, null, 2))}>Exportar registro remoto completo</Button></div>
    <p className="muted">El respaldo portable conserva preguntas, turno y progreso; no conserva autoría histórica ni toda la lista de saltadas. El registro remoto completo conserva esos metadatos para archivo y no es un archivo de importación.</p>
    {creator && <><label className="block">Respaldo local, del HTML original o banco JSON/CSV<input className="input mt-2" type="file" accept=".json,.csv" disabled={disabled || snapshot.members.length !== 2} onChange={async e => {
      const file = e.target.files?.[0]; setPreview(null); setConfirmed(false); setError("");
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("El archivo supera 5 MB.");
        setPreview(parseImport(await file.text(), file.name, snapshot.categories));
      } catch (error) { setError(error instanceof Error ? error.message : "Archivo inválido."); }
    }} /></label>
    {preview && <div className="space-y-3"><h3>Vista previa</h3><p>{preview.bank.questions.length} preguntas · {preview.bank.categories.length} categorías · {preview.restoredState ? Object.keys(preview.restoredState.completed).length : 0} completadas en el archivo.</p>
      <p>{preview.bank.questions.filter(q => !snapshot.questions.some(current => current.id === q.id)).length} preguntas nuevas por ID. Las colisiones de ID o número con contenido diferente se rechazan sin cambios parciales.</p>
      {preview.restoredState && <><p>El progreso completo solo se puede importar a una sala sin uso. Si esta sala ya tiene cambios, crea otra o fusiona únicamente el banco.</p>{snapshot.members.map(m => <p key={m.id}>Posición {m.position}: {preview.restoredState?.players[m.position]} → {m.displayName}</p>)}</>}
      <p>Fusionar banco conserva el progreso y la configuración remotos; no renumera preguntas ni sobrescribe existentes. Fechas históricas desconocidas se mantienen desconocidas.</p>
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Revisé el contenido y la asignación de jugadores.</label>
      <Button disabled={disabled || !confirmed} onClick={async () => { if (await execute({ action: "merge_bank", document: preview.bank })) setPreview(null); }}>Fusionar solo banco</Button>
      {preview.restoredState && <Button variant="secondary" disabled={disabled || !confirmed} onClick={async () => { if (await execute({ action: "import_backup", document: preview.restoredState })) setPreview(null); }}>Importar progreso a esta sala sin uso</Button>}
    </div>}</>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
