import type { GameState } from "@/types";
import { migrateState, validateState } from "@/lib/validation/schema";

export const STORAGE_KEY = "entre-nosotros:game";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GameRepository {
  load(): { state: GameState | null; token: string | null };
  save(state: GameState, expectedToken: string | null): string;
  raw(): string | null;
}

export class StorageConflictError extends Error {
  constructor() { super("Otra pestaña cambió la partida. Se cargaron sus cambios; vuelve a intentar tu acción."); }
}

export class LocalGameRepository implements GameRepository {
  constructor(private readonly storage: StoragePort) {}

  raw() { return this.storage.getItem(STORAGE_KEY); }

  load() {
    const token = this.raw();
    if (token === null) return { state: null, token };
    let value: unknown;
    try { value = JSON.parse(token); }
    catch { throw new Error("Los datos guardados contienen JSON dañado."); }
    return { state: migrateState(value), token };
  }

  save(state: GameState, expectedToken: string | null): string {
    if (this.raw() !== expectedToken) throw new StorageConflictError();
    const token = JSON.stringify(validateState(state));
    this.storage.setItem(STORAGE_KEY, token);
    return token;
  }
}
