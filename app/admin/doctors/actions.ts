"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext, type AdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

type DoctorManagerContext = AdminContext & { organization: NonNullable<AdminContext["organization"]> };

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured?.startsWith("https://") && !configured.includes("localhost")) return configured;
  return production ? `https://${production}` : "https://www.apollomd.com.br";
}

async function requireDoctorManager(): Promise<DoctorManagerContext> {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "doctors:manage")) redirect("/admin/doctors?error=access");
  return context as DoctorManagerContext;
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
  return null;
}

async function provisionDoctorAccess(context: DoctorManagerContext, doctorId: string, email: string, fullName: string, resendExisting = false) {
  const admin = createAdminClient();
  let user = await findAuthUserByEmail(email);
  let invited = false;
  let accessSent = false;

  if (!user) {
    const result = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${appUrl()}/auth/callback?next=/set-password`,
    });
    if (result.error || !result.data.user) throw result.error ?? new Error("invite failed");
    user = result.data.user;
    invited = true;
  }

  const status = user.email_confirmed_at ? "active" : "invited";
  const { data: linkedDoctor } = await admin.from("doctors").select("id").eq("organization_id", context.organization.id).eq("user_id", user.id).neq("id", doctorId).maybeSingle();
  if (linkedDoctor) throw new Error("user already linked to another doctor");
  if (!invited && (resendExisting || !user.email_confirmed_at)) {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}/auth/callback?next=/set-password`,
    });
    if (error) throw error;
    accessSent = true;
  }
  const { data: existingMembership } = await admin.from("organization_memberships").select("role,status").eq("organization_id", context.organization.id).eq("user_id", user.id).maybeSingle();
  const membershipRole = existingMembership?.role === "organization_admin" ? "organization_admin" : "doctor";
  const membershipStatus = existingMembership?.status === "active" ? "active" : status;

  const [{ error: profileError }, { error: membershipError }, { error: doctorError }] = await Promise.all([
    admin.from("profiles").upsert({ id: user.id, full_name: fullName, status: membershipStatus }),
    admin.from("organization_memberships").upsert({ organization_id: context.organization.id, user_id: user.id, role: membershipRole, status: membershipStatus }, { onConflict: "organization_id,user_id" }),
    admin.from("doctors").update({ user_id: user.id, email }).eq("id", doctorId).eq("organization_id", context.organization.id),
  ]);
  if (profileError || membershipError || doctorError) throw profileError ?? membershipError ?? doctorError;

  await admin.from("audit_logs").insert({
    organization_id: context.organization.id,
    actor_user_id: context.user.id,
    action: invited ? "doctor.access_invited" : accessSent ? "doctor.access_resent" : "doctor.access_linked",
    entity_type: "doctor",
    entity_id: doctorId,
    metadata: { user_id: user.id, membership_status: membershipStatus },
  });
  return invited ? "invited" : accessSent ? "access_sent" : "linked";
}

export async function createDoctor(formData: FormData) {
  const context = await requireDoctorManager();
  const displayName = clean(formData.get("display_name"));
  const email = clean(formData.get("email")).toLowerCase();
  if (displayName.length < 2 || !validEmail(email)) redirect("/admin/doctors?error=validation");

  const supabase = await createClient();
  const { data: doctor, error } = await supabase.from("doctors").insert({
    organization_id: context.organization.id,
    display_name: displayName,
    email,
    specialty: clean(formData.get("specialty")) || null,
    professional_registration: clean(formData.get("professional_registration")) || null,
  }).select("id").single();
  if (error || !doctor) redirect("/admin/doctors?error=save");

  let result: string;
  try {
    result = await provisionDoctorAccess(context, doctor.id, email, displayName);
  } catch {
    revalidatePath("/admin/doctors");
    redirect(`/admin/doctors/${doctor.id}?error=invite`);
  }
  revalidatePath("/admin/doctors");
  redirect(`/admin/doctors/${doctor.id}?saved=${result}`);
}

export async function updateDoctor(formData: FormData) {
  const context = await requireDoctorManager();
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
  redirect(`/admin/doctors/${id}?saved=updated`);
}

export async function configureDoctorAccess(formData: FormData) {
  const context = await requireDoctorManager();
  const doctorId = clean(formData.get("doctor_id"));
  const email = clean(formData.get("email")).toLowerCase();
  if (!doctorId || !validEmail(email)) redirect(`/admin/doctors/${doctorId}?error=validation`);
  const admin = createAdminClient();
  const { data: doctor } = await admin.from("doctors").select("id,display_name").eq("id", doctorId).eq("organization_id", context.organization.id).maybeSingle();
  if (!doctor) redirect("/admin/doctors?error=not_found");
  let result: string;
  try {
    result = await provisionDoctorAccess(context, doctor.id, email, doctor.display_name, true);
  } catch {
    redirect(`/admin/doctors/${doctor.id}?error=invite`);
  }
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${doctor.id}`);
  redirect(`/admin/doctors/${doctor.id}?saved=${result}`);
}

export async function sendDoctorAccessLink(formData: FormData) {
  const context = await requireDoctorManager();
  const doctorId = clean(formData.get("doctor_id"));
  const admin = createAdminClient();
  const { data: doctor } = await admin.from("doctors").select("id,user_id,email,display_name").eq("id", doctorId).eq("organization_id", context.organization.id).maybeSingle();
  if (!doctor?.email) redirect(`/admin/doctors/${doctorId}?error=email`);
  let result: string;
  try {
    result = await provisionDoctorAccess(context, doctor.id, doctor.email, doctor.display_name, true);
  } catch {
    redirect(`/admin/doctors/${doctorId}?error=invite`);
  }
  revalidatePath(`/admin/doctors/${doctor.id}`);
  redirect(`/admin/doctors/${doctor.id}?saved=${result}`);
}

export async function toggleDoctorStatus(formData: FormData) {
  const context = await requireDoctorManager();
  const id = clean(formData.get("id"));
  const status = clean(formData.get("status")) === "active" ? "inactive" : "active";
  const supabase = await createClient();
  const { error } = await supabase.from("doctors").update({ status }).eq("id", id).eq("organization_id", context.organization.id);
  if (error) redirect(`/admin/doctors/${id}?error=save`);
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${id}`);
  redirect(`/admin/doctors/${id}?saved=updated`);
}
