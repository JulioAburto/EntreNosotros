import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { SharedGame } from "@/components/remote/shared-game";

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const { client } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) notFound();
  const result = await client.rpc("get_game_snapshot", { p_game_id: gameId });
  if (result.error) throw new Error("No pudimos consultar la partida. Inténtalo de nuevo.");
  if (!result.data) notFound();
  return <SharedGame key={gameId} gameId={gameId} />;
}
