import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type AdminContext = {
  user: { id: string; email: string | null };
  role: AppRole;
  organization: { id: string; name: string; slug: string } | null;
};

export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership && !platformAdmin) redirect("/login?error=access");

  let organization: AdminContext["organization"] = null;
  if (membership) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", membership.organization_id)
      .single();
    organization = data;
  } else if (platformAdmin) {
    const { data } = await supabase.from("organizations").select("id, name, slug").limit(1).maybeSingle();
    organization = data;
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    role: platformAdmin ? "platform_admin" : (membership?.role as AppRole),
    organization,
  };
});
