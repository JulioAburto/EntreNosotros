export interface Question {
  id: string;
  number: number;
  text: string;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  source: "initial" | "custom";
  intendedResponder?: Player;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  source: "initial" | "custom";
}

export type Player = 0 | 1;
export type Theme = "light" | "dark" | "system";

export interface GameState {
  schemaVersion: 2;
  questions: Question[];
  categories: Category[];
  completed: Record<string, string>;
  players: [string, string];
  currentPlayer: Player;
  enabledCategoryIds: string[];
  activeQuestionId: string | null;
  lastSkippedId: string | null;
  nextQuestionNumber: number;
  theme: Theme;
}

export interface BankFile {
  format: "entre-nosotros-bank";
  version: 1;
  categories: Category[];
  questions: Question[];
}

export interface BackupFile {
  format: "entre-nosotros-backup";
  version: 2;
  exportedAt: string;
  state: GameState;
}
