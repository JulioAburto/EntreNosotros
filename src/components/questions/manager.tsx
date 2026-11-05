"use client";

import { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { gameActions, useGame } from "@/features/game/store";
import { Button, ConfirmDialog, PageHeading } from "@/components/ui/primitives";
import { QuestionList } from "./question-list";
import { CategoryForm, QuestionForm } from "./question-form";
import { ImportExportPanel } from "./import-export-panel";
import { LegacyImport } from "./legacy-import";
import { RecipientForm } from "./recipient-form";
import type { Question } from "@/types";

export function Manager() {
  const { blocked } = useGame();
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [categoryForm, setCategoryForm] = useState(false);
  const [recipient, setRecipient] = useState<Question | null>(null);
  return <><PageHeading eyebrow="LA HISTORIA NO TERMINA EN CIEN" title="Administrar preguntas">Más recuerdos, nuevas curiosidades, infinitas conversaciones.</PageHeading><div className="flex flex-wrap gap-3 mb-8"><Button disabled={blocked} onClick={() => setEditing("new")}><Plus size={18} />Crear pregunta</Button><Button disabled={blocked} variant="secondary" onClick={() => setCategoryForm(true)}><FolderPlus size={18} />Crear categoría</Button></div><ImportExportPanel /><LegacyImport /><section className="mt-10"><h2 className="mb-5">Nuestro banco de preguntas</h2><QuestionList manage onEdit={setEditing} onDelete={setDeleting} onRecipient={setRecipient} /></section>
    {recipient && <RecipientForm question={recipient} onClose={() => setRecipient(null)} />}{editing && <QuestionForm question={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}{categoryForm && <CategoryForm onClose={() => setCategoryForm(false)} />}{deleting && <ConfirmDialog title={`¿Eliminar la pregunta ${deleting.number}?`} confirmLabel="Eliminar pregunta" onClose={() => setDeleting(null)} onConfirm={() => { gameActions.deleteQuestion(deleting.id); setDeleting(null); }}>Se eliminará esta pregunta personalizada y su progreso. Su número no se reutilizará. Esta acción no se puede deshacer sin un respaldo.</ConfirmDialog>}
  </>;
}
