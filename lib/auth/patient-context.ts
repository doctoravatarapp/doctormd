import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getPatientContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/patient/login");
  const { data: patient } = await supabase.from("patients").select("id, organization_id, full_name, preferred_name, status").eq("auth_user_id", user.id).eq("status", "active").maybeSingle();
  if (!patient) redirect("/patient/login?error=access");
  return { user, patient };
});
