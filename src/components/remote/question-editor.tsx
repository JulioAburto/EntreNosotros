"use client";
import { useState } from "react";
import { Button, Dialog } from "@/components/ui/primitives";
import type { GameCommand, RemoteQuestion, RemoteSnapshot } from "@/features/remote/types";

export function RemoteQuestionEditor({ snapshot, question, busy, execute, close }: {
  snapshot: RemoteSnapshot; question?: RemoteQuestion; busy: boolean;
  execute: (command: GameCommand) => Promise<boolean>; close: () => void;
}) {
  const [text, setText] = useState(question?.text ?? "");
  const [categoryId, setCategoryId] = useState(question?.category_id ?? snapshot.categories[0]?.id ?? "");
  const [responderId, setResponderId] = useState(question?.intended_responder_member_id ?? "");
  const [isActive, setActive] = useState(question?.is_active ?? true);
  const original = question?.source === "initial";
  return <Dialog title={question ? "Editar pregunta" : "Crear pregunta"} onClose={close}>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault();
      const command: GameCommand = question
        ? { action: "edit_question", questionId: question.id, text, categoryId, responderId: responderId || null, isActive }
        : { action: "add_question", id: `custom-${crypto.randomUUID()}`, text, categoryId, responderId: responderId || null };
      if (await execute(command)) close();
    }}>
      <label className="block">Pregunta<textarea className="input" required maxLength={2000} value={text} disabled={original || busy} onChange={e => setText(e.target.value)} /></label>
      <label className="block">Categoría<select className="input" value={categoryId} disabled={original || busy} onChange={e => setCategoryId(e.target.value)}>{snapshot.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <label className="block">Destinatario<select className="input" value={responderId} disabled={busy} onChange={e => setResponderId(e.target.value)}><option value="">Sin asignar</option>{snapshot.members.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label>
      {question && <label><input type="checkbox" checked={isActive} disabled={busy} onChange={e => setActive(e.target.checked)} /> Activa</label>}
      {original && <p className="muted">El texto y la categoría original se conservan exactamente.</p>}
      <Button type="submit" disabled={busy}>Guardar pregunta</Button>
    </form>
  </Dialog>;
}
