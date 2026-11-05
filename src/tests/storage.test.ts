import { describe, expect, it } from "vitest";
import { createInitialState } from "@/features/game/rules";
import { LocalGameRepository, STORAGE_KEY, StorageConflictError, type StoragePort } from "@/lib/storage/repository";

function memoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe("repositorio local", () => {
  it("recupera pregunta activa, filtros, progreso, nombres y turno después de recrear el repositorio", () => {
    const storage = memoryStorage();
    const first = new LocalGameRepository(storage);
    const state = createInitialState();
    state.completed = { "initial-001": "2026-10-28T00:00:00.000Z" };
    state.activeQuestionId = "initial-002";
    state.enabledCategoryIds = ["amor"];
    state.currentPlayer = 1;
    state.players = ["J", "N"];
    first.save(state, null);
    const second = new LocalGameRepository(storage);
    expect(second.load().state).toEqual(state);
  });
  it("detecta corrupción y no sobrescribe los datos dañados al leer", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{damaged");
    const repository = new LocalGameRepository(storage);
    expect(() => repository.load()).toThrow(/dañado/);
    expect(repository.raw()).toBe("{damaged");
  });
  it("propaga fallos de lectura y cuota para que la UI advierta al usuario", () => {
    const broken = new LocalGameRepository({ getItem: () => { throw new Error("denied"); }, setItem: () => undefined });
    expect(() => broken.load()).toThrow("denied");
    const full = new LocalGameRepository({ getItem: () => null, setItem: () => { throw new Error("quota"); } });
    expect(() => full.save(createInitialState(), null)).toThrow("quota");
  });
  it("rechaza escrituras desde una pestaña desactualizada", () => {
    const storage = memoryStorage();
    const first = new LocalGameRepository(storage);
    const second = new LocalGameRepository(storage);
    const token = first.save(createInitialState(), null);
    const next = { ...createInitialState(), theme: "dark" as const };
    first.save(next, token);
    expect(() => second.save(createInitialState(), token)).toThrow(StorageConflictError);
    expect(second.load().state?.theme).toBe("dark");
  });
});
