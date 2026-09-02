import { PageHeader } from "@/components/admin/page-header";
import { FormDrawer } from "@/components/admin/form-drawer";
import { SettingsNav } from "@/components/admin/settings-nav";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { RedFlagRuleForm } from "@/components/admin/red-flag-rule-form";
import Link from "next/link";

export default async function RedFlagsSettings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams; const context = await getAdminContext(); const db = await createClient();
  const { data: rules } = context.organization ? await db.from("red_flag_rules").select("id,category,signal,priority,recommended_action,status").eq("organization_id", context.organization.id).order("category").order("signal") : { data: [] };
  return <main className="admin-content"><PageHeader eyebrow="SISTEMA" title="RED Flags" description="Sinais de alerta classificados por categoria e nível de prioridade, com a ação enviada após confirmação do paciente." /><div className="settings-layout"><SettingsNav active="RED Flags" /><section className="settings-content">{params.saved ? <p className="success-message">Regra salva.</p> : null}{params.error ? <p className="form-error">Não foi possível salvar a regra.</p> : null}<article className="panel table-panel">{rules?.length ? <div className="data-table">{rules.map((rule) => <Link className="data-row" href={`/admin/settings/red-flags/${rule.id}`} key={rule.id}><span className="row-avatar">△</span><div><strong>{rule.signal}</strong><small>{rule.category} · {priorityLabel(rule.priority||undefined)}</small><small>Ação: {rule.recommended_action}</small></div><span className="status-badge">{rule.status}</span><span>→</span></Link>)}</div> : <p className="muted-copy">Nenhuma regra configurada.</p>}</article></section></div><FormDrawer label="Nova regra adicional" title="Nova RED Flag" description="Cadastre categoria, sinal de alerta, prioridade, ação recomendada e expressões similares."><RedFlagRuleForm /></FormDrawer></main>;
}

function priorityLabel(priority?: string) {
  if (priority === "immediate_emergency") return "Emergência imediata";
  if (priority === "contact_surgeon") return "Contatar o cirurgião";
  if (priority === "home_guidance") return "Orientação domiciliar";
  return "Prioridade personalizada";
}
