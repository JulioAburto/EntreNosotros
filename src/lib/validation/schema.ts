import { initialCategories } from "@/data/categories";
import { initialQuestions } from "@/features/game/rules";
import type { BankFile, Category, GameState, Question } from "@/types";

export const MAX_QUESTIONS = 10_000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 2_000;

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: se esperaba un objeto.`);
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label}: escribe entre 1 y ${max} caracteres.`);
  return value;
}

function identifier(value: unknown, label: string): string {
  const result = text(value, label, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result) || Object.hasOwn(Object.prototype, result) || result === "prototype") throw new Error(`${label}: identificador inválido.`);
  return result;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) throw new Error(`${label}: se esperaba un entero positivo menor o igual a mil millones.`);
  return value;
}

export function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error(`${label}: usa una fecha ISO UTC válida.`);
  if (new Date(result).toISOString() !== (result.includes(".") ? result : result.replace("Z", ".000Z"))) throw new Error(`${label}: la fecha no existe en el calendario.`);
  return result;
}

function array(value: unknown, label: string, max = MAX_QUESTIONS): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label}: se esperaba una lista de hasta ${max} elementos.`);
  return value;
}

export function normalizedText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function validateCategory(value: unknown): Category {
  const entry = object(value, "Categoría");
  const id = identifier(entry.id, "ID de categoría");
  const name = text(entry.name, "Nombre de categoría", 80);
  const color = text(entry.color, "Color", 7);
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error("El color debe tener formato hexadecimal #RRGGBB.");
  if (entry.source !== "initial" && entry.source !== "custom") throw new Error("Origen de categoría inválido.");
  const original = initialCategories.find(category => category.id === id);
  if ((original && (name !== original.name || color !== original.color || entry.source !== "initial")) || (!original && entry.source === "initial")) throw new Error(`La categoría original ${id} no se puede modificar.`);
  return { id, name, color, source: entry.source };
}

export function validateQuestion(value: unknown): Question {
  const entry = object(value, "Pregunta");
  const id = identifier(entry.id, "ID de pregunta");
  const number = positiveInteger(entry.number, "Número de pregunta");
  const questionText = text(entry.text, `Pregunta ${number}`);
  const categoryId = identifier(entry.categoryId, `Categoría de pregunta ${number}`);
  if (typeof entry.isActive !== "boolean") throw new Error(`Pregunta ${number}: isActive debe ser booleano.`);
  if (entry.source !== "initial" && entry.source !== "custom") throw new Error(`Pregunta ${number}: origen inválido.`);
  const createdAt = timestamp(entry.createdAt, `Fecha de pregunta ${number}`);
  const original = initialQuestions.find(question => question.id === id);
  if ((original && (questionText !== original.text || number !== original.number || categoryId !== original.categoryId || entry.source !== "initial" || createdAt !== original.createdAt)) || (!original && entry.source === "initial")) throw new Error(`Pregunta ${number}: el contenido original es de solo lectura.`);
  if (entry.intendedResponder !== undefined && entry.intendedResponder !== 0 && entry.intendedResponder !== 1) throw new Error(`Pregunta ${number}: destinatario inválido; usa 0 o 1.`);
  return { id, number, text: questionText, categoryId, isActive: entry.isActive, createdAt, source: entry.source, ...(entry.intendedResponder === undefined ? {} : { intendedResponder: entry.intendedResponder as 0 | 1 }) };
}

function uniqueIds(items: { id: string }[], label: string) {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`${label}: ID repetido «${item.id}».`);
    ids.add(item.id);
  }
}

export function validateBank(value: unknown): BankFile {
  const entry = object(value, "Banco");
  if (entry.format !== "entre-nosotros-bank" || entry.version !== 1) throw new Error("Formato de banco no compatible. Usa format: entre-nosotros-bank y version: 1.");
  const categories = array(entry.categories, "Categorías", 100).map(validateCategory);
  const questions = array(entry.questions, "Preguntas").map(validateQuestion);
  uniqueIds(categories, "Categorías");
  uniqueIds(questions, "Preguntas");
  const categoryIds = new Set(categories.map(category => category.id));
  for (const question of questions) {
    if (!categoryIds.has(question.categoryId)) throw new Error(`Pregunta ${question.number}: categoría desconocida «${question.categoryId}». Inclúyela en categories.`);
  }
  return { format: "entre-nosotros-bank", version: 1, categories, questions };
}

export function validateState(value: unknown): GameState {
  const entry = object(value, "Partida");
  if (entry.schemaVersion !== 2) throw new Error("Versión de partida no compatible.");
  const bank = validateBank({ ...entry, format: "entre-nosotros-bank", version: 1 });
  for (const original of initialQuestions) {
    if (!bank.questions.some(question => question.id === original.id)) throw new Error(`Falta la pregunta original ${original.number}.`);
  }
  for (const category of initialCategories) {
    if (!bank.categories.some(item => item.id === category.id)) throw new Error(`Falta la categoría original ${category.name}.`);
  }
  const numbers = new Set(bank.questions.map(question => question.number));
  if (numbers.size !== bank.questions.length) throw new Error("Hay números de pregunta repetidos.");
  if (new Set(bank.questions.map(question => normalizedText(question.text))).size !== bank.questions.length) throw new Error("El respaldo contiene preguntas con texto duplicado.");
  const questionIds = new Set(bank.questions.map(question => question.id));
  const completedEntries = object(entry.completed, "Progreso");
  const completed: Record<string, string> = {};
  for (const [id, date] of Object.entries(completedEntries)) {
    if (!questionIds.has(id)) throw new Error(`El progreso referencia una pregunta desconocida: ${id}.`);
    completed[id] = timestamp(date, "Fecha de respuesta");
  }
  const players = array(entry.players, "Jugadores", 2).map(player => text(player, "Nombre", 30).trim());
  if (players.length !== 2) throw new Error("La partida necesita exactamente dos personas.");
  if (entry.currentPlayer !== 0 && entry.currentPlayer !== 1) throw new Error("Turno inválido.");
  const enabledCategoryIds = array(entry.enabledCategoryIds, "Filtros", 100).map(id => identifier(id, "Filtro"));
  if (new Set(enabledCategoryIds).size !== enabledCategoryIds.length || enabledCategoryIds.some(id => !bank.categories.some(category => category.id === id))) throw new Error("La selección de categorías es inválida.");
  if (entry.activeQuestionId !== null && (typeof entry.activeQuestionId !== "string" || !questionIds.has(entry.activeQuestionId) || completed[entry.activeQuestionId])) throw new Error("La pregunta en curso es inválida.");
  const active = bank.questions.find(question => question.id === entry.activeQuestionId);
  if (active?.intendedResponder !== undefined && active.intendedResponder === entry.currentPlayer) throw new Error("La pregunta activa está asignada a quien pregunta, no a quien responde.");
  const lastSkippedId = entry.lastSkippedId ?? null;
  if (lastSkippedId !== null && (typeof lastSkippedId !== "string" || !questionIds.has(lastSkippedId))) throw new Error("La pregunta saltada es inválida.");
  const nextQuestionNumber = positiveInteger(entry.nextQuestionNumber, "Próximo número");
  if (bank.questions.some(question => question.number >= nextQuestionNumber)) throw new Error("El próximo número de pregunta debe superar los existentes.");
  if (!["light", "dark", "system"].includes(String(entry.theme))) throw new Error("Tema inválido.");
  return {
    schemaVersion: 2,
    questions: bank.questions,
    categories: bank.categories,
    completed,
    players: [players[0]!, players[1]!],
    currentPlayer: entry.currentPlayer,
    enabledCategoryIds,
    activeQuestionId: entry.activeQuestionId as string | null,
    lastSkippedId: lastSkippedId as string | null,
    nextQuestionNumber,
    theme: entry.theme as GameState["theme"],
  };
}

export function migrateState(value: unknown): GameState {
  const entry = object(value, "Datos guardados");
  if (entry.schemaVersion === 2) return validateState(entry);
  if (entry.schemaVersion === 1) {
    const questions = array(entry.questions, "Preguntas").map(validateQuestion);
    const completedIds = array(entry.completedIds, "Preguntas completadas").map(id => identifier(id, "Pregunta completada"));
    return validateState({
      ...entry,
      schemaVersion: 2,
      completed: Object.fromEntries(completedIds.map(id => [id, "1970-01-01T00:00:00.000Z"])),
      activeQuestionId: null,
      nextQuestionNumber: Math.max(0, ...questions.map(question => question.number)) + 1,
      theme: entry.theme ?? "system",
    });
  }
  throw new Error("Versión de datos desconocida. Conserva una copia y abre la versión compatible de la aplicación.");
}
