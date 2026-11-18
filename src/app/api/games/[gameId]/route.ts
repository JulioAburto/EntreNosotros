import { authenticatedClient, failure, json, readBody, RequestError, rpcError, uuid } from "@/lib/remote/http";
import { commandInput } from "@/lib/remote/commands";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ gameId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const gameId = uuid((await context.params).gameId);
    const client = await authenticatedClient();
    const result = await client.rpc("get_game_snapshot", { p_game_id: gameId }); rpcError(result.error);
    if (!result.data) throw new RequestError(404, "not_found", "Partida no disponible.");
    return json(result.data);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const gameId = uuid((await context.params).gameId);
    const command = commandInput(await readBody(request));
    const client = await authenticatedClient();
    const result = command.p_command === "profile"
      ? await client.rpc("set_member_name", { p_game_id: gameId, p_command_id: command.p_command_id, p_expected_revision: command.p_expected_revision, p_name: (command.p_payload as { name: string }).name })
      : await client.rpc("game_command", { p_game_id: gameId, ...command });
    rpcError(result.error);
    return json(result.data);
  } catch (error) { return failure(error); }
}
