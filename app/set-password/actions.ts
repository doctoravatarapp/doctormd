"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setInvitedPassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 12 || password !== confirmation) redirect("/set-password?error=validation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/set-password?error=save");
  const admin = createAdminClient();
  await Promise.all([
    admin.from("profiles").update({ status: "active" }).eq("id", user.id),
    admin.from("organization_memberships").update({ status: "active" }).eq("user_id", user.id).eq("status", "invited"),
  ]);
  redirect("/admin");
}
