import { requireUser } from "@/lib/supabase/server";
import { RoomLobby } from "@/components/remote/lobby";

export default async function RoomPage() {
  await requireUser();
  return <RoomLobby />;
}
