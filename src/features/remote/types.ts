export interface RoomSummary { id: string; name: string; memberId: string; position: 0 | 1; displayName: string }
export interface JoinRequest { id: string; gameId: string; displayName: string; status: "pending" | "approved" | "rejected"; expired: boolean; revoked: boolean; mine: boolean }
export interface Lobby { games: RoomSummary[]; requests: JoinRequest[] }
export interface RemoteMember { id: string; position: 0 | 1; displayName: string }
export interface RemoteQuestion {
  id: string; number: number; text: string; category_id: string; is_active: boolean;
  source: "initial" | "custom"; created_at: string; intended_responder_member_id: string | null;
}
export interface RemoteSnapshot {
  gameId: string; name: string; revision: number; viewerMemberId: string;
  currentMemberId: string; activeQuestionId: string | null; nextQuestionNumber: number;
  enabledCategoryIds: string[]; skippedQuestionIds: string[]; lastSkippedQuestionId: string | null;
  members: RemoteMember[];
  categories: { id: string; name: string; color: string; source: "initial" | "custom" }[];
  questions: RemoteQuestion[];
  completions: { question_id: string; completed_at: string | null; responder_member_id: string | null; provenance: string }[];
}
export type GameCommand =
  | { action: "profile"; name: string }
  | { action: "import_backup" | "merge_bank"; document: unknown }
  | { action: "reserve" | "recover_skipped" }
  | { action: "complete" | "skip" | "uncomplete" | "mark_complete" | "delete_question"; questionId: string }
  | { action: "settings"; categoryIds: string[] }
  | { action: "turn"; memberId: string }
  | { action: "reset"; memberId: string; clearProgress: boolean }
  | { action: "add_question"; id: string; text: string; categoryId: string; responderId: string | null }
  | { action: "edit_question"; questionId: string; text: string; categoryId: string; responderId: string | null; isActive: boolean }
  | { action: "add_category"; id: string; name: string; color: string };
export type CommandEnvelope = GameCommand & { commandId: string; revision: number };
