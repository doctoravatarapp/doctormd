"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function patientLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/patient/login?error=credentials");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/patient/login?error=credentials");
  const { data: patient } = await supabase.from("patients").select("id").eq("auth_user_id", data.user.id).eq("status", "active").maybeSingle();
  if (!patient) { await supabase.auth.signOut(); redirect("/patient/login?error=access"); }
  redirect("/patient");
}

export async function patientLogout() {
  const supabase = await createClient(); await supabase.auth.signOut(); redirect("/patient/login");
}
