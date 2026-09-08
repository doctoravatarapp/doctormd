"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const allowedPriorities = ["home_guidance", "contact_surgeon", "immediate_emergency"] as const;
type JsonObject = { [key: string]: Json | undefined };

function jsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export async function saveRedFlagRule(form: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "red_flags:manage")) redirect("/admin/settings/red-flags?error=access");

  const category = value(form, "category");
  const signal = value(form, "signal");
  const recommendedAction = value(form, "recommended_action");
  const id = value(form, "id");
  const priority = value(form, "priority") as typeof allowedPriorities[number];
  const target = id ? `/admin/settings/red-flags/${id}` : "/admin/settings/red-flags";
  if (category.length < 2 || signal.length < 2 || recommendedAction.length < 2 || !allowedPriorities.includes(priority)) redirect(`${target}?error=validation`);

  const supabase = await createClient();
  let existingConfiguration: JsonObject = {};
  if (id) {
    const { data: existing } = await supabase.from("red_flag_rules").select("configuration").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
    if (!existing) redirect(`${target}?error=not_found`);
    existingConfiguration = jsonObject(existing.configuration);
  }

  const existingMatcher = jsonObject(existingConfiguration.matcher);
  const phrases = [signal, ...value(form, "similar_expressions").split(/\r?\n/)]
    .map((item) => item.trim())
    .filter((item, index, all) => item.length >= 2 && all.indexOf(item) === index);
  const severity: "low" | "high" | "critical" = priority === "immediate_emergency" ? "critical" : priority === "contact_surgeon" ? "high" : "low";
  const configuration = {
    ...existingConfiguration,
    schema_version: 2,
    source: typeof existingConfiguration.source === "string" ? existingConfiguration.source : "organization",
    category,
    priority,
    recommended_action: recommendedAction,
    matcher: { ...existingMatcher, phrases },
  };
  const payload = { name: signal, description: category, severity, configuration };
  const result = id
    ? await supabase.from("red_flag_rules").update(payload).eq("id", id).eq("organization_id", context.organization.id)
    : await supabase.from("red_flag_rules").insert({ ...payload, organization_id: context.organization.id, created_by: context.user.id });
  if (result.error) redirect(`${target}?error=save`);

  await supabase.from("audit_logs").insert({
    organization_id: context.organization.id,
    actor_user_id: context.user.id,
    action: id ? "red_flag_rule.updated" : "red_flag_rule.created",
    entity_type: "red_flag_rule",
    entity_id: id || null,
    metadata: { category, priority },
  });
  revalidatePath("/admin/settings/red-flags");
  if (id) revalidatePath(target);
  redirect(`${target}?saved=1`);
}

export async function toggleRedFlagRule(form: FormData) {
  const context = await getAdminContext();
  if (!context.organization || !can(context.role, "red_flags:manage")) redirect("/admin/settings/red-flags?error=access");
  const id = value(form, "id");
  const supabase = await createClient();
  const { error } = await supabase.from("red_flag_rules").update({ status: value(form, "status") === "active" ? "inactive" : "active" }).eq("id", id).eq("organization_id", context.organization.id);
  if (error) redirect(`/admin/settings/red-flags/${id}?error=save`);
  revalidatePath("/admin/settings/red-flags");
  revalidatePath(`/admin/settings/red-flags/${id}`);
  redirect(`/admin/settings/red-flags/${id}?saved=1`);
}
