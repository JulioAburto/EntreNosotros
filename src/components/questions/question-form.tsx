"use client";

import { useState, type FormEvent } from "react";
import { gameActions, useGame } from "@/features/game/store";
import { Button, Dialog } from "@/components/ui/primitives";
import { MAX_TEXT_LENGTH } from "@/lib/validation/schema";
import type { Question } from "@/types";

export function QuestionForm({ question, onClose }: { question?: Question; onClose: () => void }) {
  const { state } = useGame();
  const [questionText, setQuestionText] = useState(question?.text ?? "");
  const [categoryId, setCategoryId] = useState(question?.categoryId ?? state?.categories[0]?.id ?? "amor");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (gameActions.saveQuestion({ id: question?.id, text: questionText, categoryId })) onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar la pregunta."); }
  }
  return <Dialog title={question ? `Editar pregunta ${question.number}` : "Una nueva forma de conocernos"} onClose={onClose}><form onSubmit={submit} className="form-stack"><label>Tu pregunta<textarea data-autofocus required maxLength={MAX_TEXT_LENGTH} rows={5} value={questionText} onChange={event => setQuestionText(event.target.value)} placeholder="¿Qué te gustaría descubrir de nosotros?" /></label><span className="muted text-xs">{questionText.length}/{MAX_TEXT_LENGTH} caracteres · El número se asigna automáticamente.</span><label>Categoría<select value={categoryId} onChange={event => setCategoryId(event.target.value)}>{state?.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar pregunta</Button></div></form></Dialog>;
}

export function CategoryForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ad3d62");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    try { if (gameActions.createCategory(name, color)) onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo crear la categoría."); }
  }
  return <Dialog title="Un nuevo tema para compartir" onClose={onClose}><form onSubmit={submit} className="form-stack"><label>Nombre de categoría<input data-autofocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label><label>Color de categoría<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit">Crear categoría</Button></form></Dialog>;
}
