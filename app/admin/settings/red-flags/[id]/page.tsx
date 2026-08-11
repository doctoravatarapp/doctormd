import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { RedFlagRuleForm } from "@/components/admin/red-flag-rule-form";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { toggleRedFlagRule } from "../actions";

export default async function RedFlagDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: rule } = await db.from("red_flag_rules").select("id,name,description,severity,status,configuration").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
  if (!rule) notFound();
  const configuration = rule.configuration as { pattern?: string };
  return <main className="admin-content crud-detail"><PageHeader eyebrow="RED FLAG" title={rule.name} description="Edite a regra em uma página dedicada e mantenha o contexto da navegação." />
    {query.saved ? <p className="success-message">Regra atualizada.</p> : null}{query.error ? <p className="form-error">Não foi possível salvar a regra.</p> : null}
    <section className="panel"><RedFlagRuleForm rule={{ ...rule, pattern: configuration.pattern || "" }} /></section>
    <section className="panel crud-status"><div><strong>Status da regra</strong><p className="muted-copy">{rule.status === "active" ? "Ativa e avaliando novas mensagens." : "Inativa e preservada no histórico."}</p></div><form action={toggleRedFlagRule}><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="status" value={rule.status} /><button className="secondary-action">{rule.status === "active" ? "Inativar regra" : "Ativar regra"}</button></form></section>
  </main>;
}
