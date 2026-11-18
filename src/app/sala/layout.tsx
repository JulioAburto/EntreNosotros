import { requireUser } from "@/lib/supabase/server";
import { SessionControls } from "@/components/auth/session-controls";

export const dynamic = "force-dynamic";

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <><div className="mb-6 flex justify-end"><SessionControls /></div>{children}</>;
}
