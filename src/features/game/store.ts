"use client";

import { useSyncExternalStore } from "react";
import { completeActiveQuestion, createInitialState, nextPlayer, selectQuestion, setQuestionCompleted, skipActiveQuestion } from "./rules";
import { LocalGameRepository, STORAGE_KEY, StorageConflictError, type GameRepository } from "@/lib/storage/repository";
import { mergeBank } from "@/lib/import-export";
import { normalizedText, validateCategory, validateQuestion, validateState } from "@/lib/validation/schema";
import type { BankFile, GameState, Player, Theme } from "@/types";
import { createId } from "@/lib/ids";

interface Snapshot {
  state: GameState | null;
  error: string | null;
  blocked: boolean;
  skipped: string[];
  sessionCompleted: string[];
}

const initialSnapshot: Snapshot = { state: null, error: null, blocked: false, skipped: [], sessionCompleted: [] };
let snapshot = initialSnapshot;
let repository: GameRepository | null = null;
let token: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function publish(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach(listener => listener());
}

function load() {
  try {
    repository ??= new LocalGameRepository(window.localStorage);
    const loaded = repository.load();
    token = loaded.token;
    publish({ state: loaded.state ?? createInitialState(), error: null, blocked: false });
  } catch (error) {
    publish({ state: snapshot.state ?? createInitialState(), blocked: true, error: `${error instanceof Error ? error.message : "No se pudo leer el almacenamiento."} No sobrescribiremos tus datos. Puedes descargarlos o recuperar la partida desde Configuración.` });
  }
}

export function initializeGame() {
  if (initialized) return;
  initialized = true;
  load();
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY || event.key === null) load();
  });
}

function commit(update: (state: GameState) => GameState): boolean {
  if (!snapshot.state || snapshot.blocked) return false;
  const state = validateState(update(snapshot.state));
  try {
    if (!repository) throw new Error("Almacenamiento no disponible.");
    token = repository.save(state, token);
    publish({ state, error: null });
  } catch (error) {
    if (error instanceof StorageConflictError) {
      load();
      publish({ error: error.message });
      return false;
    }
    publish({ state, error: "No se pudo guardar en este navegador. Los cambios están solo en memoria: exporta un respaldo antes de cerrar o intenta guardar de nuevo en Configuración." });
  }
  return true;
}

export const gameActions = {
  spin() {
    if (!snapshot.state || snapshot.blocked || snapshot.state.activeQuestionId) return null;
    const question = selectQuestion(snapshot.state, snapshot.skipped);
    if (!question) return null;
    return commit(state => ({ ...state, activeQuestionId: question.id })) ? question : null;
  },
  complete() {
    const id = snapshot.state?.activeQuestionId;
    if (!id || snapshot.state?.completed[id]) return;
    if (commit(state => completeActiveQuestion(state, new Date().toISOString()))) {
      publish({ sessionCompleted: [...new Set([...snapshot.sessionCompleted, id])] });
    }
  },
  skip() {
    const id = snapshot.state?.activeQuestionId;
    if (id && commit(skipActiveQuestion)) publish({ skipped: [...new Set([...snapshot.skipped, id])] });
  },
  recoverSkipped() { if (commit(state => ({ ...state, lastSkippedId: null }))) publish({ skipped: [] }); },
  changeTurn() { commit(state => state.activeQuestionId ? state : { ...state, currentPlayer: nextPlayer(state.currentPlayer) }); },
  setCompleted(id: string, checked: boolean) {
    const wasActive = snapshot.state?.activeQuestionId === id;
    if (commit(state => setQuestionCompleted(state, id, checked, new Date().toISOString()))) {
      if (!checked) publish({ skipped: snapshot.skipped.filter(item => item !== id), sessionCompleted: snapshot.sessionCompleted.filter(item => item !== id) });
      else if (wasActive) publish({ sessionCompleted: [...new Set([...snapshot.sessionCompleted, id])] });
    }
  },
  setCategories(ids: string[]) {
    commit(state => ({ ...state, enabledCategoryIds: ids }));
  },
  setPlayers(players: [string, string]) { return commit(state => ({ ...state, players: [players[0].trim(), players[1].trim()] })); },
  setTheme(theme: Theme) { commit(state => ({ ...state, theme })); },
  newGame(currentPlayer: Player, clearProgress: boolean) {
    if (commit(state => ({ ...state, currentPlayer, activeQuestionId: null, lastSkippedId: null, completed: clearProgress ? {} : state.completed }))) {
      publish({ skipped: [], sessionCompleted: [] });
    }
  },
  saveQuestion(input: { id?: string; text: string; categoryId: string; intendedResponder?: Player }) {
    return commit(state => {
      const existing = state.questions.find(question => question.id === input.id);
      if (input.id && input.id === state.activeQuestionId) throw new Error("Completa o salta la pregunta antes de editarla.");
      if (input.id && (!existing || existing.source !== "custom")) throw new Error("Solo puedes editar preguntas personalizadas.");
      if (state.questions.some(question => question.id !== input.id && normalizedText(question.text) === normalizedText(input.text))) throw new Error("Esta pregunta ya existe en el banco.");
      const question = validateQuestion({
        id: existing?.id ?? createId("custom"),
        number: existing?.number ?? state.nextQuestionNumber,
        text: input.text.trim(),
        categoryId: input.categoryId,
        isActive: existing?.isActive ?? true,
        source: "custom",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        intendedResponder: input.intendedResponder ?? existing?.intendedResponder,
      });
      return { ...state, questions: existing ? state.questions.map(item => item.id === question.id ? question : item) : [...state.questions, question], nextQuestionNumber: state.nextQuestionNumber + (existing ? 0 : 1) };
    });
  },
  deleteQuestion(id: string) {
    return commit(state => {
      if (id === state.activeQuestionId) throw new Error("Completa o salta la pregunta antes de eliminarla.");
      if (!state.questions.some(question => question.id === id && question.source === "custom")) throw new Error("Las preguntas originales no se pueden eliminar.");
      const completed = { ...state.completed };
      delete completed[id];
      return { ...state, questions: state.questions.filter(question => question.id !== id), completed, activeQuestionId: state.activeQuestionId === id ? null : state.activeQuestionId, lastSkippedId: state.lastSkippedId === id ? null : state.lastSkippedId };
    });
  },
  setActive(id: string, isActive: boolean) {
    commit(state => ({ ...state, questions: state.questions.map(question => question.id === id ? { ...question, isActive } : question) }));
  },
  setRecipient(id: string, intendedResponder?: Player) {
    return commit(state => {
      if (state.activeQuestionId === id) throw new Error("Completa o salta esta pregunta antes de cambiar su destinatario.");
      return { ...state, questions: state.questions.map(question => question.id === id ? { ...question, intendedResponder } : question) };
    });
  },
  createCategory(name: string, color: string) {
    return commit(state => {
      if (state.categories.some(category => normalizedText(category.name) === normalizedText(name))) throw new Error("Ya existe una categoría con ese nombre.");
      const category = validateCategory({ id: createId("category"), name: name.trim(), color, source: "custom" });
      return { ...state, categories: [...state.categories, category], enabledCategoryIds: [...state.enabledCategoryIds, category.id] };
    });
  },
  merge(bank: BankFile) {
    if (!snapshot.state) throw new Error("La partida todavía está cargando.");
    const result = mergeBank(snapshot.state, bank);
    if (!commit(() => result.state)) throw new Error("No se importaron datos. Revisa el aviso de almacenamiento y vuelve a intentarlo.");
    return { added: result.added, skipped: result.skipped };
  },
  restore(state: GameState) {
    if (!commit(() => validateState(state))) throw new Error("No se pudo restaurar. Revisa el aviso de almacenamiento.");
    publish({ skipped: [], sessionCompleted: [] });
  },
  retrySave() { commit(state => state); },
  readRaw() { return repository?.raw() ?? window.localStorage.getItem(STORAGE_KEY); },
  recover() {
    const previous = snapshot;
    try {
      repository ??= new LocalGameRepository(window.localStorage);
      const currentToken = repository.raw();
      const state = createInitialState();
      token = repository.save(state, currentToken);
      publish({ state, blocked: false, error: null, skipped: [], sessionCompleted: [] });
    } catch {
      publish({ ...previous, error: "No se pudo recuperar el almacenamiento. Habilita el almacenamiento del sitio o utiliza otro navegador." });
    }
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useGame() {
  return useSyncExternalStore(subscribe, () => snapshot, () => initialSnapshot);
}
