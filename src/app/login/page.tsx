import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const client = await createServerSupabase();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/sala");
  return <LoginForm />;
}
