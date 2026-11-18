import { randomBytes } from "node:crypto";
import { authenticatedClient, failure, json, readBody, RequestError, rpcError, text, uuid } from "@/lib/remote/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const client = await authenticatedClient();
    const result = await client.rpc("get_room_lobby"); rpcError(result.error);
    return json(result.data);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const client = await authenticatedClient();
    if (body.action === "create") {
      const result = await client.rpc("create_room", { p_game_id: uuid(body.id), p_name: text(body.name, 80), p_display_name: text(body.displayName, 30) });
      rpcError(result.error); return json({ gameId: result.data });
    }
    if (body.action === "invite") {
      const token = randomBytes(32).toString("hex");
      const result = await client.rpc("create_invitation", { p_game_id: uuid(body.gameId), p_token: token });
      rpcError(result.error); return json({ token });
    }
    if (body.action === "join") {
      const token = text(body.token, 64);
      if (!/^[a-f0-9]{64}$/.test(token)) throw new RequestError(400, "invalid", "Invitación inválida.");
      const result = await client.rpc("request_join", { p_token: token, p_display_name: text(body.displayName, 30) });
      rpcError(result.error); return json({ requestId: result.data });
    }
    if (body.action === "decide") {
      if (typeof body.approve !== "boolean") throw new RequestError(400, "invalid", "Decisión inválida.");
      const result = await client.rpc("decide_join", { p_game_id: uuid(body.gameId), p_request_id: uuid(body.requestId), p_approve: body.approve });
      rpcError(result.error); return json({ ok: true });
    }
    if (body.action === "revoke") {
      const result = await client.rpc("revoke_invitations", { p_game_id: uuid(body.gameId) });
      rpcError(result.error); return json({ ok: true });
    }
    throw new RequestError(400, "invalid", "Acción desconocida.");
  } catch (error) { return failure(error); }
}
