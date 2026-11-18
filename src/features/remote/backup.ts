import type { RemoteSnapshot } from "./types";
import type { GameState } from "@/types";
import { validateState } from "@/lib/validation/schema";

export function portableState(snapshot: RemoteSnapshot): GameState {
  const members = [...snapshot.members].sort((a, b) => a.position - b.position);
  const first = members[0], second = members[1];
  if (!first || !second) throw new Error("Espera a que ambos jugadores estén en la sala.");
  return validateState({
    schemaVersion: 2, categories: snapshot.categories,
    questions: snapshot.questions.map(q => ({ id: q.id, number: q.number, text: q.text, categoryId: q.category_id,
      isActive: q.is_active, source: q.source, createdAt: new Date(q.created_at).toISOString(),
      ...(q.intended_responder_member_id ? { intendedResponder: members.find(m => m.id === q.intended_responder_member_id)?.position } : {}),
    })),
    completed: Object.fromEntries(snapshot.completions.map(c => [c.question_id, c.completed_at ? new Date(c.completed_at).toISOString() : "1970-01-01T00:00:00.000Z"])),
    players: [first.displayName, second.displayName], currentPlayer: members.find(m => m.id === snapshot.currentMemberId)?.position,
    enabledCategoryIds: snapshot.enabledCategoryIds, activeQuestionId: snapshot.activeQuestionId,
    lastSkippedId: snapshot.lastSkippedQuestionId, nextQuestionNumber: snapshot.nextQuestionNumber, theme: "system",
  });
}
