import { PageHeader } from "@/components/admin/page-header";
import { FormDrawer } from "@/components/admin/form-drawer";
import { SettingsNav } from "@/components/admin/settings-nav";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { RedFlagRuleForm } from "@/components/admin/red-flag-rule-form";
import Link from "next/link";

export default async function RedFlagsSettings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams; const context = await getAdminContext(); const db = await createClient();
  const { data: rules } = context.organization ? await db.from("red_flag_rules").select("id,name,description,severity,status,configuration").eq("organization_id", context.organization.id).order("created_at", { ascending: false }) : { data: [] };
  return <main className="admin-content"><PageHeader eyebrow="SISTEMA" title="RED Flags" description="Regras explícitas de atenção definidas pela equipe." /><div className="settings-layout"><SettingsNav active="RED Flags" /><section className="settings-content">{params.saved ? <p className="success-message">Regra salva.</p> : null}{params.error ? <p className="form-error">Não foi possível salvar a regra.</p> : null}<article className="panel table-panel">{rules?.length ? <div className="data-table">{rules.map((rule) => { const configuration = rule.configuration as { pattern?: string }; return <Link className="data-row" href={`/admin/settings/red-flags/${rule.id}`} key={rule.id}><span className="row-avatar">△</span><div><strong>{rule.name}</strong><small>{configuration.pattern} · {rule.severity}</small></div><span className="status-badge">{rule.status}</span><span>→</span></Link>; })}</div> : <p className="muted-copy">Nenhuma regra configurada. Crie uma regra somente quando houver um termo operacional explícito.</p>}</article></section></div><FormDrawer label="Nova regra" title="Nova RED Flag" description="Defina o termo e a severidade operacional."><RedFlagRuleForm /></FormDrawer></main>;
}
