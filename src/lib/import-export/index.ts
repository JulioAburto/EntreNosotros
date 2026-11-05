import type { BackupFile, BankFile, Category, GameState } from "@/types";
import { MAX_IMPORT_BYTES, MAX_QUESTIONS, migrateState, normalizedText, object, timestamp, validateBank, validateState } from "@/lib/validation/schema";
import { parseCsv } from "./csv";
import { migrateLegacy } from "./legacy";
import { createId } from "@/lib/ids";

export type ImportDocument = { bank: BankFile; restoredState: GameState | null };

export function parseImport(content: string, fileName: string, categories: Category[]): ImportDocument {
  if (new TextEncoder().encode(content).length > MAX_IMPORT_BYTES) throw new Error("El archivo supera el límite de 5 MB.");
  if (fileName.toLowerCase().endsWith(".csv")) {
    const rows = parseCsv(content);
    const questions = rows.map((row, index) => {
      if (row.isActive && !["true", "false"].includes(row.isActive)) throw new Error(`CSV, fila ${index + 2}: isActive debe ser true o false.`);
      return {
        id: row.id || createId("custom"),
        number: row.number ? Number(row.number) : index + 1,
        text: row.text,
        categoryId: row.categoryId,
        isActive: row.isActive !== "false",
        createdAt: row.createdAt || new Date().toISOString(),
        source: row.source || "custom",
      };
    });
    return { bank: validateBank({ format: "entre-nosotros-bank", version: 1, categories, questions }), restoredState: null };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(content.replace(/^\uFEFF/, "")); }
  catch { throw new Error("JSON inválido. Revisa las comas, las comillas y la estructura del archivo."); }
  const entry = object(parsed, "Archivo");
  if ("completed" in entry && "enabledCategories" in entry && "nextAsker" in entry && !entry.format) {
    const state = migrateLegacy(entry);
    return { bank: toBank(state), restoredState: state };
  }
  if (entry.format === "entre-nosotros-backup") {
    if (entry.version !== 1 && entry.version !== 2) throw new Error("Versión de respaldo no compatible.");
    timestamp(entry.exportedAt, "Fecha del respaldo");
    const state = migrateState(entry.state);
    return { bank: toBank(state), restoredState: state };
  }
  return { bank: validateBank(entry), restoredState: null };
}

export function mergeBank(state: GameState, bank: BankFile): { state: GameState; added: number; skipped: number } {
  const checked = validateBank(bank);
  const categories = [...state.categories];
  const categoryMapping = new Map<string, string>();
  for (const category of checked.categories) {
    const existing = categories.find(item => item.id === category.id);
    if (existing && (existing.name !== category.name || existing.color !== category.color)) throw new Error(`La categoría ${category.id} ya existe con otros datos.`);
    const equivalent = existing ?? categories.find(item => normalizedText(item.name) === normalizedText(category.name));
    if (equivalent) categoryMapping.set(category.id, equivalent.id);
    else {
      categories.push(category);
      categoryMapping.set(category.id, category.id);
    }
  }
  const questions = [...state.questions];
  const ids = new Map(questions.map(question => [question.id, question]));
  const texts = new Set(questions.map(question => normalizedText(question.text)));
  let nextQuestionNumber = state.nextQuestionNumber;
  let skipped = 0;
  for (const question of checked.questions) {
    const categoryId = categoryMapping.get(question.categoryId)!;
    const existing = ids.get(question.id);
    if (existing) {
      if (normalizedText(existing.text) !== normalizedText(question.text) || existing.categoryId !== categoryId) throw new Error(`El ID ${question.id} ya pertenece a otra pregunta. No se cambió ningún dato.`);
      skipped++;
      continue;
    }
    if (texts.has(normalizedText(question.text))) {
      skipped++;
      continue;
    }
    const added = { ...question, categoryId, number: nextQuestionNumber++ };
    questions.push(added);
    ids.set(added.id, added);
    texts.add(normalizedText(added.text));
  }
  if (questions.length > MAX_QUESTIONS) throw new Error(`El banco admite hasta ${MAX_QUESTIONS} preguntas en este dispositivo.`);
  const newCategoryIds = categories.filter(category => !state.categories.some(existing => existing.id === category.id)).map(category => category.id);
  return {
    state: validateState({ ...state, questions, categories, nextQuestionNumber, enabledCategoryIds: [...state.enabledCategoryIds, ...newCategoryIds] }),
    added: questions.length - state.questions.length,
    skipped,
  };
}

export function toBank(state: GameState): BankFile {
  return { format: "entre-nosotros-bank", version: 1, questions: state.questions, categories: state.categories };
}

export function toBackup(state: GameState): BackupFile {
  return { format: "entre-nosotros-backup", version: 2, exportedAt: new Date().toISOString(), state };
}

export function downloadFile(fileName: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
