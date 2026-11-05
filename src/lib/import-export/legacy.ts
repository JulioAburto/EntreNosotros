import { initialCategories } from "@/data/categories";
import { createInitialState, initialQuestions } from "@/features/game/rules";
import { object, validateState } from "@/lib/validation/schema";
import type { GameState, Player } from "@/types";

export const LEGACY_STORAGE_KEY = "verdad_o_verdad_julio_naza_v1";

function numericIds(value: unknown, max: number, label: string): number[] {
  if (!Array.isArray(value) || value.some(id => !Number.isInteger(id) || id < 1 || id > max)) throw new Error(`Legado: ${label} contiene IDs inválidos.`);
  if (new Set(value).size !== value.length) throw new Error(`Legado: ${label} contiene IDs repetidos.`);
  return value as number[];
}

function player(value: unknown): Player {
  if (value !== "Julio" && value !== "Naza") throw new Error("Legado: el turno debe pertenecer a Julio o Naza.");
  return value === "Julio" ? 0 : 1;
}

function questionId(value: unknown): string | null {
  if (value === null) return null;
  const question = initialQuestions.find(item => item.number === value);
  if (!question) throw new Error("Legado: ID de pregunta activa o saltada inválido.");
  return question.id;
}

export function migrateLegacy(value: unknown): GameState {
  const entry = object(value, "Partida del HTML");
  const completed = numericIds(entry.completed, initialQuestions.length, "completed");
  const enabled = numericIds(entry.enabledCategories, initialCategories.length, "enabledCategories");
  const activeId = questionId(entry.activeId);
  const lastSkippedId = questionId(entry.lastSkippedId);
  const nextAsker = player(entry.nextAsker);
  if (entry.activeAsker !== null) player(entry.activeAsker);
  const activeCompleted = completed.some(number => questionId(number) === activeId);
  return validateState({
    ...createInitialState(),
    completed: Object.fromEntries(completed.map(number => [questionId(number), "1970-01-01T00:00:00.000Z"])),
    enabledCategoryIds: enabled.map(id => initialCategories[id - 1]!.id),
    activeQuestionId: activeCompleted ? null : activeId,
    currentPlayer: activeId && !activeCompleted ? player(entry.activeAsker ?? entry.nextAsker) : nextAsker,
    lastSkippedId,
  });
}
