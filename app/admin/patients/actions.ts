"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function createPatient(formData: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "patients:create")) redirect("/admin/patients?error=access");

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) redirect("/admin/patients?error=validation");

  const supabase = await createClient();
  const { error } = await supabase.from("patients").insert({
    organization_id: context.organization.id,
    full_name: fullName,
    preferred_name: optional(formData.get("preferred_name")),
    email: optional(formData.get("email")),
    phone: optional(formData.get("phone")),
    birth_date: optional(formData.get("birth_date")),
  });

  if (error) redirect("/admin/patients?error=save");
  revalidatePath("/admin/patients");
  redirect("/admin/patients?created=1");
}
