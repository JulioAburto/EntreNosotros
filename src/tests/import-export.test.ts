import { describe, expect, it } from "vitest";
import { createInitialState, eligibleQuestions } from "@/features/game/rules";
import { mergeBank, parseImport, toBackup, toBank } from "@/lib/import-export";
import { parseCsv } from "@/lib/import-export/csv";
import { migrateLegacy } from "@/lib/import-export/legacy";
import { migrateState, timestamp, validateBank, validateState } from "@/lib/validation/schema";
import type { BankFile, Question } from "@/types";

const date = "2026-10-28T12:00:00.000Z";
const custom = (index: number): Question => ({ id: `custom-${index}`, number: index, text: `Una pregunta nueva ${index}`, categoryId: "amor", isActive: true, createdAt: date, source: "custom" });
const bank = (questions: Question[]): BankFile => ({ ...toBank(createInitialState()), questions });
const legacy = { completed: [1, 21, 100], enabledCategories: [1, 3, 10], activeId: 22, activeAsker: "Naza", nextAsker: "Julio", lastSkippedId: 23 };

describe("importación atómica", () => {
  it("rechaza fechas imposibles y tarjetas asignadas a la persona incorrecta", () => {
    expect(() => timestamp("2026-02-31T00:00:00.000Z", "Fecha")).toThrow(/no existe/);
    const state = createInitialState();
    state.questions[0]!.intendedResponder = 0;
    state.activeQuestionId = "initial-001";
    expect(() => validateState(state)).toThrow(/quien pregunta/);
  });
  it("agrega sin borrar progreso, filtros, turno ni pregunta activa y renumera sin colisiones", () => {
    const state = createInitialState();
    state.completed = { "initial-001": date };
    state.currentPlayer = 1;
    state.activeQuestionId = "initial-002";
    state.nextQuestionNumber = 120;
    const merged = mergeBank(state, bank([custom(1), custom(2)]));
    expect(merged.added).toBe(2);
    expect(merged.state.completed).toEqual(state.completed);
    expect(merged.state.currentPlayer).toBe(1);
    expect(merged.state.activeQuestionId).toBe("initial-002");
    expect(merged.state.enabledCategoryIds).toEqual(state.enabledCategoryIds);
    expect(merged.state.questions.slice(-2).map(question => question.number)).toEqual([120, 121]);
    expect(eligibleQuestions(merged.state).some(question => question.id === "custom-1")).toBe(true);
    expect(state.questions).toHaveLength(100);
  });

  it("omite textos duplicados y IDs existentes equivalentes", () => {
    const state = createInitialState();
    const duplicate = { ...custom(1), text: state.questions[0]!.text };
    const result = mergeBank(state, bank([state.questions[0]!, duplicate, custom(2), { ...custom(3), text: custom(2).text }]));
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(3);
  });

  it("rechaza IDs repetidos, conflictos de identidad, categorías desconocidas y originales alterados", () => {
    const state = createInitialState();
    expect(() => mergeBank(state, bank([custom(1), custom(1)]))).toThrow(/ID repetido/);
    const merged = mergeBank(state, bank([custom(1)])).state;
    expect(() => mergeBank(merged, bank([{ ...custom(1), text: "Otra pregunta" }]))).toThrow(/otra pregunta/);
    expect(() => validateBank(bank([{ ...custom(1), categoryId: "no-existe" }]))).toThrow(/desconocida/);
    expect(() => mergeBank(state, bank([{ ...state.questions[0]!, text: "Modificada" }]))).toThrow(/solo lectura/);
    expect(state.questions).toHaveLength(100);
  });

  it("importa 200 nuevas preguntas y conserva el siguiente número", () => {
    const result = mergeBank(createInitialState(), bank(Array.from({ length: 200 }, (_, index) => custom(index + 1))));
    expect(result.state.questions).toHaveLength(300);
    expect(result.state.nextQuestionNumber).toBe(301);
    expect(validateState(result.state)).toEqual(result.state);
  });

  it("exporta y restaura toda la partida, incluido destinatario y pregunta activa", () => {
    const state = createInitialState();
    state.questions[0]!.intendedResponder = 1;
    state.completed = { "initial-002": date };
    state.activeQuestionId = "initial-001";
    state.lastSkippedId = "initial-003";
    const document = parseImport(JSON.stringify(toBackup(state)), "respaldo.json", state.categories);
    expect(document.restoredState).toEqual(state);
    expect(parseImport(JSON.stringify(toBank(state)), "banco.json", state.categories).restoredState).toBeNull();
  });

  it("rechaza respaldos incompletos, versiones futuras, tipos y campos peligrosos", () => {
    const state = createInitialState();
    expect(() => validateState({ ...state, questions: state.questions.slice(1) })).toThrow(/Falta/);
    expect(() => migrateState({ ...state, schemaVersion: 90 })).toThrow(/Versión/);
    expect(() => validateState({ ...state, currentPlayer: 5 })).toThrow(/Turno/);
    expect(() => validateBank(bank([{ ...custom(1), id: "__proto__" }]))).toThrow(/identificador/);
    expect(() => validateBank(bank([{ ...custom(1), id: "toString" }]))).toThrow(/identificador/);
    expect(() => validateBank(bank([{ ...custom(1), isActive: "false" } as unknown as Question]))).toThrow(/booleano/);
    expect(() => parseImport("{broken", "a.json", state.categories)).toThrow(/JSON inválido/);
  });
});

describe("CSV", () => {
  it("admite BOM, CRLF, comas, saltos y comillas escapadas", () => {
    const result = parseCsv('\uFEFFtext,categoryId\r\n"Una pregunta, con ""comillas""\ny dos líneas",amor\r\n');
    expect(result).toEqual([{ text: 'Una pregunta, con "comillas"\ny dos líneas', categoryId: "amor" }]);
  });
  it("valida columnas, comillas y booleanos", () => {
    expect(() => parseCsv("foo,bar\nuno,dos")).toThrow(/encabezados/);
    expect(() => parseCsv('text,categoryId\n"mal,amor')).toThrow(/sin cerrar/);
    expect(() => parseCsv("text,categoryId\nuno,dos,tres")).toThrow(/columnas/);
    expect(() => parseImport("text,categoryId,isActive\nPrueba,amor,no", "test.csv", createInitialState().categories)).toThrow(/true o false/);
  });
  it("asigna IDs nuevos, detecta duplicados y mantiene Unicode", () => {
    const state = createInitialState();
    const parsed = parseImport("text,categoryId\n¿Un recuerdo de mañana? ❤️,amor\n¿Un recuerdo de mañana? ❤️,amor", "preguntas.csv", state.categories);
    expect(parsed.bank.questions[0]?.id).not.toBe(parsed.bank.questions[1]?.id);
    expect(mergeBank(state, parsed.bank).added).toBe(1);
  });
});

describe("compatibilidad legado", () => {
  it("transforma IDs numéricos sin perder progreso, categorías ni roles activos", () => {
    const state = migrateLegacy(legacy);
    expect(Object.keys(state.completed)).toEqual(["initial-001", "initial-021", "initial-100"]);
    expect(state.enabledCategoryIds).toEqual(["amor", "historia", "complicidad"]);
    expect(state.activeQuestionId).toBe("initial-022");
    expect(state.currentPlayer).toBe(1);
    expect(state.lastSkippedId).toBe("initial-023");
    expect(parseImport(JSON.stringify(legacy), "legacy.json", state.categories).restoredState).toEqual(state);
  });
  it("si la activa ya fue completada, conserva nextAsker y libera la tarjeta", () => {
    const state = migrateLegacy({ ...legacy, activeId: 21 });
    expect(state.currentPlayer).toBe(0);
    expect(state.activeQuestionId).toBeNull();
  });
  it("rechaza datos inválidos en vez de descartar progreso silenciosamente", () => {
    expect(() => migrateLegacy({ ...legacy, completed: [101] })).toThrow(/IDs inválidos/);
    expect(() => migrateLegacy({ ...legacy, enabledCategories: [0] })).toThrow(/IDs inválidos/);
    expect(() => migrateLegacy({ ...legacy, activeAsker: "Desconocido" })).toThrow(/turno/);
  });
  it("migra el esquema interno v1 conservando las completadas", () => {
    const state = createInitialState();
    const migrated = migrateState({ ...state, schemaVersion: 1, completedIds: ["initial-001"] });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.completed["initial-001"]).toBe("1970-01-01T00:00:00.000Z");
  });
});
