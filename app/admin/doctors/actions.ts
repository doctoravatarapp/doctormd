"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim();

export async function createDoctor(formData: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "doctors:manage")) redirect("/admin/doctors?error=access");
  const displayName = clean(formData.get("display_name"));
  if (displayName.length < 2) redirect("/admin/doctors?error=validation");
  const supabase = await createClient();
  const { error } = await supabase.from("doctors").insert({
    organization_id: context.organization.id,
    display_name: displayName,
    specialty: clean(formData.get("specialty")) || null,
    professional_registration: clean(formData.get("professional_registration")) || null,
  });
  if (error) redirect("/admin/doctors?error=save");
  revalidatePath("/admin/doctors");
  redirect("/admin/doctors?created=1");
}

export async function updateDoctor(formData: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "doctors:manage")) redirect("/admin/doctors?error=access");
  const id = clean(formData.get("id"));
  const displayName = clean(formData.get("display_name"));
  if (!id || displayName.length < 2) redirect(id ? `/admin/doctors/${id}?error=validation` : "/admin/doctors?error=validation");
  const supabase = await createClient();
  const { error } = await supabase.from("doctors").update({
    display_name: displayName,
    specialty: clean(formData.get("specialty")) || null,
    professional_registration: clean(formData.get("professional_registration")) || null,
  }).eq("id", id).eq("organization_id", context.organization.id);
  if (error) redirect(`/admin/doctors/${id}?error=save`);
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${id}`);
  redirect(`/admin/doctors/${id}?saved=1`);
}

export async function toggleDoctorStatus(formData: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "doctors:manage")) redirect("/admin/doctors?error=access");
  const id = clean(formData.get("id"));
  const status = clean(formData.get("status")) === "active" ? "inactive" : "active";
  const supabase = await createClient();
  const { error } = await supabase.from("doctors").update({ status }).eq("id", id).eq("organization_id", context.organization.id);
  if (error) redirect(`/admin/doctors/${id}?error=save`);
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${id}`);
  redirect(`/admin/doctors/${id}?saved=1`);
}
