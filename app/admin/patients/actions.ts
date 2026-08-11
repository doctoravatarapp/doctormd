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

export async function updatePatient(formData: FormData) {
  const context = await getAdminContext();
  const id = String(formData.get("id") ?? "").trim();
  if (!context.organization || !can(context.role, "patients:create")) redirect(`/admin/patients/${id}?error=access`);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const status = String(formData.get("status") ?? "active") as "active" | "inactive";
  if (!id || fullName.length < 2 || !["active", "inactive"].includes(status)) redirect(`/admin/patients/${id}?error=validation`);
  const supabase = await createClient();
  const { error } = await supabase.from("patients").update({
    full_name: fullName,
    preferred_name: optional(formData.get("preferred_name")),
    email: optional(formData.get("email")),
    phone: optional(formData.get("phone")),
    birth_date: optional(formData.get("birth_date")),
    status,
  }).eq("id", id).eq("organization_id", context.organization.id);
  if (error) redirect(`/admin/patients/${id}?error=save`);
  revalidatePath("/admin/patients");
  revalidatePath(`/admin/patients/${id}`);
  redirect(`/admin/patients/${id}?saved=1`);
}
