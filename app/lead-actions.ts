"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const teamSizes = new Set(["solo", "2-5", "6-15", "16-50", "51+"]);
const goals = new Set(["productivity", "follow-up", "patient-experience", "automation", "other"]);

function value(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export async function submitSalesLead(formData: FormData) {
  const website = value(formData, "website", 200);
  if (website) redirect("/?lead=success#demonstracao");

  const fullName = value(formData, "full_name", 120);
  const email = value(formData, "email", 254).toLowerCase();
  const phone = value(formData, "phone", 30);
  const organizationName = value(formData, "organization_name", 160);
  const teamSize = value(formData, "team_size", 10);
  const primaryGoal = value(formData, "primary_goal", 30);
  const consent = formData.get("consent") === "on";

  if (fullName.length < 2 || !emailPattern.test(email) || !consent || !teamSizes.has(teamSize) || !goals.has(primaryGoal)) {
    redirect("/?lead=validation#demonstracao");
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("sales_leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 3) redirect("/?lead=success#demonstracao");

  const { error } = await admin.from("sales_leads").insert({
    full_name: fullName,
    email,
    phone: phone || null,
    organization_name: organizationName || null,
    team_size: teamSize as "solo" | "2-5" | "6-15" | "16-50" | "51+",
    primary_goal: primaryGoal as "productivity" | "follow-up" | "patient-experience" | "automation" | "other",
    consent_at: new Date().toISOString(),
    metadata: { form_version: "landing-v1" },
  });

  if (error) {
    console.error("sales_lead_insert_failed", { code: error.code });
    redirect("/?lead=error#demonstracao");
  }

  redirect("/?lead=success#demonstracao");
}
