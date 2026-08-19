"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses=new Set(["new","contacted","qualified","won","lost"]);
export async function updateLeadStatus(formData:FormData){
  const context=await getAdminContext();if(!can(context.role,"leads:manage")||!context.organization)redirect("/admin");
  const id=String(formData.get("id")??""),status=String(formData.get("status")??"");
  if(!id||!statuses.has(status))redirect(`/admin/leads/${id}?error=validation`);
  const{error}=await createAdminClient().from("sales_leads").update({status:status as "new"|"contacted"|"qualified"|"won"|"lost"}).eq("id",id).eq("organization_id",context.organization.id);
  if(error)redirect(`/admin/leads/${id}?error=save`);
  revalidatePath("/admin/leads");revalidatePath(`/admin/leads/${id}`);redirect("/admin/leads?updated=1");
}
