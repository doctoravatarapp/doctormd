"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/permissions";
import { getAdminContext, type AdminContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

const roles = ["organization_admin", "doctor", "staff"] as const;
const statuses = ["active", "inactive"] as const;

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return configured || (production ? `https://${production}` : "https://apollomd.vercel.app");
}

type TeamManagerContext = AdminContext & { organization: NonNullable<AdminContext["organization"]> };

async function requireTeamManager(): Promise<TeamManagerContext> {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "team:manage")) redirect("/admin/team?error=access");
  return context as TeamManagerContext;
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

export async function inviteTeamMember(form: FormData) {
  const context = await requireTeamManager();
  const email = value(form, "email").toLowerCase();
  const fullName = value(form, "full_name");
  const role = value(form, "role") as typeof roles[number];
  if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || !roles.includes(role)) redirect("/admin/team?error=validation");

  const admin = createAdminClient();
  let user = await findAuthUserByEmail(email);
  let status: "active" | "invited" = "active";

  if (!user) {
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${appUrl()}/auth/callback?next=/set-password`,
    });
    if (invited.error || !invited.data.user) redirect("/admin/team?error=invite");
    user = invited.data.user;
    status = "invited";
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    status,
  });
  if (profileError) redirect("/admin/team?error=save");

  const { error: membershipError } = await admin.from("organization_memberships").upsert({
    organization_id: context.organization.id,
    user_id: user.id,
    role,
    status,
  }, { onConflict: "organization_id,user_id" });
  if (membershipError) redirect("/admin/team?error=save");

  await admin.from("audit_logs").insert({
    organization_id: context.organization.id,
    actor_user_id: context.user.id,
    action: user.invited_at ? "team.member_invited" : "team.member_added",
    entity_type: "organization_membership",
    entity_id: user.id,
    metadata: { role, status },
  });
  revalidatePath("/admin/team");
  redirect(`/admin/team?saved=${status === "invited" ? "invited" : "added"}`);
}

export async function updateTeamMember(form: FormData) {
  const context = await requireTeamManager();
  const membershipId = value(form, "membership_id");
  const fullName = value(form, "full_name");
  const role = value(form, "role") as typeof roles[number];
  const status = value(form, "status") as typeof statuses[number];
  const target = membershipId ? `/admin/team/${membershipId}` : "/admin/team";
  if (!membershipId || fullName.length < 2 || !roles.includes(role) || !statuses.includes(status)) redirect(`${target}?error=validation`);

  const admin = createAdminClient();
  const { data: member } = await admin.from("organization_memberships").select("id,user_id,role,status").eq("id", membershipId).eq("organization_id", context.organization.id).maybeSingle();
  if (!member) redirect("/admin/team?error=not_found");
  if (member.user_id === context.user.id && (role !== member.role || status !== member.status)) redirect(`${target}?error=self`);

  if (member.role === "organization_admin" && member.status === "active" && (role !== "organization_admin" || status !== "active")) {
    const { count } = await admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", context.organization.id).eq("role", "organization_admin").eq("status", "active");
    if ((count ?? 0) <= 1) redirect(`${target}?error=last_admin`);
  }

  const [{ error: profileError }, { error: membershipError }] = await Promise.all([
    admin.from("profiles").update({ full_name: fullName }).eq("id", member.user_id),
    admin.from("organization_memberships").update({ role, status }).eq("id", member.id).eq("organization_id", context.organization.id),
  ]);
  if (profileError || membershipError) redirect(`${target}?error=save`);
  await admin.from("audit_logs").insert({ organization_id: context.organization.id, actor_user_id: context.user.id, action: "team.member_updated", entity_type: "organization_membership", entity_id: member.id, metadata: { role, status } });
  revalidatePath("/admin/team");
  revalidatePath(`/admin/team/${member.id}`);
  redirect(`/admin/team/${member.id}?saved=updated`);
}

export async function sendTeamAccessLink(form: FormData) {
  const context = await requireTeamManager();
  const membershipId = value(form, "membership_id");
  if (!membershipId) redirect("/admin/team?error=validation");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("organization_memberships")
    .select("id,user_id")
    .eq("id", membershipId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (!member) redirect("/admin/team?error=not_found");

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(member.user_id);
  const email = authUser.user?.email;
  if (userError || !email) redirect(`/admin/team/${membershipId}?error=email`);

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/callback?next=/set-password`,
  });
  if (error) redirect(`/admin/team/${membershipId}?error=email`);

  await admin.from("audit_logs").insert({
    organization_id: context.organization.id,
    actor_user_id: context.user.id,
    action: "team.access_link_sent",
    entity_type: "organization_membership",
    entity_id: member.id,
    metadata: { user_id: member.user_id },
  });
  redirect(`/admin/team/${membershipId}?saved=access_sent`);
}

export async function removeTeamMember(form: FormData) {
  const context = await requireTeamManager();
  const membershipId = value(form, "membership_id");
  const admin = createAdminClient();
  const { data: member } = await admin.from("organization_memberships").select("id,user_id,role,status").eq("id", membershipId).eq("organization_id", context.organization.id).maybeSingle();
  if (!member) redirect("/admin/team?error=not_found");
  if (member.user_id === context.user.id) redirect("/admin/team?error=self");
  if (member.role === "organization_admin" && member.status === "active") {
    const { count } = await admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", context.organization.id).eq("role", "organization_admin").eq("status", "active");
    if ((count ?? 0) <= 1) redirect("/admin/team?error=last_admin");
  }
  const { error } = await admin.from("organization_memberships").delete().eq("id", member.id).eq("organization_id", context.organization.id);
  if (error) redirect("/admin/team?error=save");
  await admin.from("audit_logs").insert({ organization_id: context.organization.id, actor_user_id: context.user.id, action: "team.member_removed", entity_type: "organization_membership", entity_id: member.id, metadata: { user_id: member.user_id } });
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=removed");
}
