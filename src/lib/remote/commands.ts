import { RequestError, text, uuid } from "./http";
import { validateBank, validateState } from "@/lib/validation/schema";

export function commandInput(body: Record<string, unknown>) {
  const id = uuid(body.commandId);
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new RequestError(400, "invalid", "Revisión inválida.");
  const action = body.action;
  if (action === "import_backup" || action === "merge_bank") {
    try {
      const data = action === "import_backup" ? validateState(body.document) : validateBank(body.document);
      return { p_command_id: id, p_expected_revision: body.revision as number, p_command: action, p_payload: data };
    } catch { throw new RequestError(400, "invalid", "El respaldo o banco no es válido. Revisa su vista previa."); }
  }
  const payload: Record<string, unknown> = {};
  if (["complete", "skip", "uncomplete", "mark_complete", "delete_question", "edit_question"].includes(String(action))) payload.questionId = text(body.questionId, 100);
  if (action === "profile") {
    payload.name = text(body.name, 30);
  } else if (action === "settings") {
    if (!Array.isArray(body.categoryIds) || body.categoryIds.length > 100) throw new RequestError(400, "invalid", "Categorías inválidas.");
    payload.categoryIds = body.categoryIds.map(value => text(value, 100));
  } else if (action === "turn" || action === "reset") {
    payload.memberId = uuid(body.memberId);
    if (action === "reset") {
      if (typeof body.clearProgress !== "boolean") throw new RequestError(400, "invalid", "Reinicio inválido.");
      payload.clearProgress = body.clearProgress;
    }
  } else if (action === "add_question" || action === "edit_question") {
    payload.text = text(body.text, 2000); payload.categoryId = text(body.categoryId, 100);
    const responder = body.responderId === null ? null : uuid(body.responderId);
    if (action === "add_question") { payload.id = text(body.id, 100); payload.intendedResponderMemberId = responder; }
    else {
      if (typeof body.isActive !== "boolean") throw new RequestError(400, "invalid", "Activación inválida.");
      payload.responderId = responder; payload.isActive = body.isActive;
    }
  } else if (action === "add_category") {
    payload.id = text(body.id, 100); payload.name = text(body.name, 80); payload.color = text(body.color, 7);
    if (!/^#[a-f0-9]{6}$/i.test(String(payload.color))) throw new RequestError(400, "invalid", "Color inválido.");
  } else if (!["reserve", "recover_skipped", "complete", "skip", "uncomplete", "mark_complete", "delete_question"].includes(String(action))) {
    throw new RequestError(400, "invalid", "Acción desconocida.");
  }
  return { p_command_id: id, p_expected_revision: body.revision as number, p_command: action as string, p_payload: payload };
}
