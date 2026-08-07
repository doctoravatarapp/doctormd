"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
const value=(form:FormData,name:string)=>String(form.get(name)??"").trim();
const allowedSeverity=["low","medium","high","critical"] as const;
export async function saveRedFlagRule(form:FormData){const context=await getAdminContext();if(!context.organization||!can(context.role,"red_flags:manage"))redirect("/admin/settings/red-flags?error=access");const name=value(form,"name"),pattern=value(form,"pattern"),description=value(form,"description"),id=value(form,"id");const severity=value(form,"severity") as typeof allowedSeverity[number];if(name.length<2||pattern.length<2||!allowedSeverity.includes(severity))redirect("/admin/settings/red-flags?error=validation");const supabase=await createClient();const payload={name,description:description||null,severity,configuration:{match_type:"contains",pattern},created_by:context.user.id};const result=id?await supabase.from("red_flag_rules").update(payload).eq("id",id).eq("organization_id",context.organization.id):await supabase.from("red_flag_rules").insert({...payload,organization_id:context.organization.id});if(result.error)redirect("/admin/settings/red-flags?error=save");revalidatePath("/admin/settings/red-flags");redirect("/admin/settings/red-flags?saved=1");}
export async function toggleRedFlagRule(form:FormData){const context=await getAdminContext();if(!context.organization||!can(context.role,"red_flags:manage"))redirect("/admin/settings/red-flags?error=access");const supabase=await createClient();await supabase.from("red_flag_rules").update({status:value(form,"status")==="active"?"inactive":"active"}).eq("id",value(form,"id")).eq("organization_id",context.organization.id);revalidatePath("/admin/settings/red-flags");}
