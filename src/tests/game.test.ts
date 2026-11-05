import { describe, expect, it, vi } from "vitest";
import { completeActiveQuestion, createInitialState, eligibleQuestions, getProgress, nextPlayer, secureRandomIndex, selectQuestion, setQuestionCompleted, skipActiveQuestion, turnParticipants } from "@/features/game/rules";
import type { Question } from "@/types";

const date = "2026-10-28T12:00:00.000Z";

describe("turnos individuales", () => {
  it("Julio pregunta, solo Naza responde y el siguiente turno invierte los papeles", () => {
    const state = createInitialState();
    expect(turnParticipants(state)).toEqual({ asker: "Julio", responder: "Naza" });
    state.activeQuestionId = "initial-001";
    const completed = completeActiveQuestion(state, date);
    expect(turnParticipants(completed)).toEqual({ asker: "Naza", responder: "Julio" });
    expect(completed.completed).toEqual({ "initial-001": date });
    expect(completeActiveQuestion(completed, date)).toBe(completed);
    expect(completed.currentPlayer).toBe(1);
    expect(completeActiveQuestion({ ...completed, activeQuestionId: "initial-002" }, date).currentPlayer).toBe(0);
  });

  it("saltar conserva el turno, deja pendiente y excluye la pregunta saltada", () => {
    const state = { ...createInitialState(), activeQuestionId: "initial-001" };
    const skipped = skipActiveQuestion(state);
    expect(skipped.currentPlayer).toBe(0);
    expect(skipped.completed).toEqual({});
    expect(skipped.activeQuestionId).toBeNull();
    expect(eligibleQuestions(skipped).some(question => question.id === "initial-001")).toBe(false);
    expect(selectQuestion(skipped, [], () => 0)?.id).toBe("initial-002");
  });

  it("completar la activa desde la lista alterna una vez; las demás no cambian el turno", () => {
    const state = { ...createInitialState(), activeQuestionId: "initial-001" };
    const completed = setQuestionCompleted(state, "initial-001", true, date);
    expect(completed.currentPlayer).toBe(1);
    expect(setQuestionCompleted(completed, "initial-001", true, date).currentPlayer).toBe(1);
    expect(setQuestionCompleted(completed, "initial-002", true, date).currentPlayer).toBe(1);
  });

  it("los papeles dependen de posiciones de jugador, incluso con nombres editados", () => {
    const state = createInitialState();
    state.players = ["Persona A", "Persona B"];
    state.currentPlayer = 1;
    expect(turnParticipants(state)).toEqual({ asker: "Persona B", responder: "Persona A" });
    expect(nextPlayer(1)).toBe(0);
  });
});

describe("selección elegible", () => {
  it("no repite completadas y permite una desmarcada", () => {
    const state = setQuestionCompleted(createInitialState(), "initial-001", true, date);
    expect(eligibleQuestions(state).some(question => question.id === "initial-001")).toBe(false);
    const unchecked = setQuestionCompleted(state, "initial-001", false, date);
    expect(selectQuestion(unchecked, [], () => 0)?.id).toBe("initial-001");
  });

  it("respeta categorías, activación, destinatario y exclusiones de sesión", () => {
    const state = createInitialState();
    state.enabledCategoryIds = ["amor"];
    state.questions[0]!.isActive = false;
    state.questions[1]!.intendedResponder = 0;
    const eligible = eligibleQuestions(state, ["initial-003"]);
    expect(eligible).toHaveLength(7);
    expect(eligible.every(question => question.categoryId === "amor")).toBe(true);
    expect(selectQuestion(state, ["initial-003"], () => 0)?.number).toBe(4);
    state.currentPlayer = 1;
    expect(eligibleQuestions(state).some(question => question.id === "initial-002")).toBe(true);
  });

  it("no asigna automáticamente destinatario a los originales", () => {
    expect(createInitialState().questions.every(question => question.intendedResponder === undefined)).toBe(true);
  });

  it("devuelve null sin consumir aleatoriedad cuando no hay elegibles", () => {
    const state = createInitialState();
    state.enabledCategoryIds = [];
    const random = vi.fn();
    expect(selectQuestion(state, [], random)).toBeNull();
    expect(random).not.toHaveBeenCalled();
    state.enabledCategoryIds = ["amor"];
    state.completed = Object.fromEntries(state.questions.map(question => [question.id, date]));
    expect(selectQuestion(state)).toBeNull();
    expect(getProgress(state).percentage).toBe(100);
  });

  it("selecciona preguntas nuevas y escala a 250 con índices equiprobables", () => {
    const state = createInitialState();
    state.enabledCategoryIds = state.categories.map(category => category.id);
    const added: Question[] = Array.from({ length: 150 }, (_, index) => ({ id: `custom-${index}`, number: index + 101, text: `Pregunta nueva ${index}`, categoryId: "amor", isActive: true, createdAt: date, source: "custom" }));
    state.questions.push(...added);
    expect(eligibleQuestions(state)).toHaveLength(250);
    const selected = Array.from({ length: 250 }, (_, index) => selectQuestion(state, [], () => index)?.number);
    expect(new Set(selected).size).toBe(250);
    expect(selectQuestion(state, [], length => length - 1)?.number).toBe(250);
  });

  it("rechaza el tramo sesgado de la fuente aleatoria y valida el tamaño", () => {
    const random = vi.spyOn(crypto, "getRandomValues");
    let calls = 0;
    random.mockImplementation(array => { (array as Uint32Array)[0] = calls++ === 0 ? 0xffffffff : 7; return array; });
    expect(secureRandomIndex(10)).toBe(7);
    expect(calls).toBe(2);
    random.mockRestore();
    expect(() => secureRandomIndex(0)).toThrow();
    expect(() => secureRandomIndex(1.5)).toThrow();
  });
});
