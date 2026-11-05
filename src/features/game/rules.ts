import questions from "@/data/questions.json";
import { initialCategories } from "@/data/categories";
import type { GameState, Player, Question } from "@/types";

export const initialQuestions = questions as Question[];

export function createInitialState(): GameState {
  return {
    schemaVersion: 2,
    questions: initialQuestions.map(question => ({ ...question })),
    categories: initialCategories.map(category => ({ ...category })),
    completed: {},
    players: ["Julio", "Naza"],
    currentPlayer: 0,
    enabledCategoryIds: initialCategories.filter(category => category.id !== "deseo").map(category => category.id),
    activeQuestionId: null,
    lastSkippedId: null,
    nextQuestionNumber: Math.max(...initialQuestions.map(question => question.number)) + 1,
    theme: "system",
  };
}

export function eligibleQuestions(state: GameState, skipped: readonly string[] = []): Question[] {
  const enabled = new Set(state.enabledCategoryIds);
  const excluded = new Set([...skipped, ...(state.lastSkippedId ? [state.lastSkippedId] : [])]);
  return state.questions.filter(question => question.isActive && enabled.has(question.categoryId) && !state.completed[question.id] && !excluded.has(question.id) && (question.intendedResponder === undefined || question.intendedResponder === nextPlayer(state.currentPlayer)));
}

export function secureRandomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0xffffffff) throw new Error("Cantidad de preguntas inválida.");
  const range = 0x100000000;
  const limit = range - range % length;
  const values = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(values);
    value = values[0]!;
  } while (value >= limit);
  return value % length;
}

export function selectQuestion(state: GameState, skipped: readonly string[] = [], randomIndex = secureRandomIndex): Question | null {
  const eligible = eligibleQuestions(state, skipped);
  if (!eligible.length) return null;
  return eligible[randomIndex(eligible.length)] ?? null;
}

export function nextPlayer(player: Player): Player {
  return player === 0 ? 1 : 0;
}

export function turnParticipants(state: GameState) {
  return { asker: state.players[state.currentPlayer], responder: state.players[nextPlayer(state.currentPlayer)] };
}

export function skipActiveQuestion(state: GameState): GameState {
  if (!state.activeQuestionId) return state;
  return { ...state, lastSkippedId: state.activeQuestionId, activeQuestionId: null };
}

export function completeActiveQuestion(state: GameState, timestamp: string): GameState {
  const question = state.questions.find(item => item.id === state.activeQuestionId);
  if (!question || state.completed[question.id]) return state;
  return {
    ...state,
    completed: { ...state.completed, [question.id]: timestamp },
    currentPlayer: nextPlayer(state.currentPlayer),
    activeQuestionId: null,
  };
}

export function setQuestionCompleted(state: GameState, id: string, checked: boolean, timestamp: string): GameState {
  if (!state.questions.some(question => question.id === id)) return state;
  if (checked && state.activeQuestionId === id) return completeActiveQuestion(state, timestamp);
  const completed = { ...state.completed };
  if (checked) completed[id] = completed[id] ?? timestamp;
  else delete completed[id];
  return { ...state, completed, lastSkippedId: state.lastSkippedId === id && !checked ? null : state.lastSkippedId };
}

export function getProgress(state: GameState, categoryId?: string) {
  const questions = state.questions.filter(question => !categoryId || question.categoryId === categoryId);
  const total = questions.length;
  const completed = questions.filter(question => Boolean(state.completed[question.id])).length;
  return { total, completed, pending: total - completed, percentage: total ? Math.round(completed / total * 100) : 0 };
}
