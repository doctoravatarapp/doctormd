"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function createEpisode(formData: FormData) {
  const context = await getAdminContext();
  const patientId = String(formData.get("patient_id") ?? "");
  if (!context.organization || !can(context.role, "episodes:create")) redirect(`/admin/patients/${patientId}?error=access`);
  const doctorId = String(formData.get("doctor_id") ?? "");
  const procedureName = String(formData.get("procedure_name") ?? "").trim();
  const procedureDate = String(formData.get("procedure_date") ?? "") || null;
  const status = String(formData.get("status") ?? "planned") as "planned" | "preoperative" | "postoperative" | "completed" | "cancelled";
  if (!patientId || !doctorId || procedureName.length < 2) redirect(`/admin/patients/${patientId}?error=validation`);
  const supabase = await createClient();
  const { data: episodeId, error } = await supabase.rpc("create_care_episode", { target_patient_id: patientId, target_doctor_id: doctorId, target_procedure_name: procedureName, target_procedure_date: procedureDate, target_status: status });
  if (error || !episodeId) redirect(`/admin/patients/${patientId}?error=episode`);
  revalidatePath("/admin"); revalidatePath(`/admin/patients/${patientId}`);
  redirect(`/admin/episodes/${episodeId}?created=1`);
}
