import { saveRedFlagRule } from "@/app/admin/settings/red-flags/actions";

type Rule = { id: string; category: string; signal: string; priority: string; recommendedAction: string; similarExpressions: string };

export function RedFlagRuleForm({ rule, readOnly = false }: { rule?: Rule; readOnly?: boolean }) {
  const fields = <>
    <input type="hidden" name="id" value={rule?.id || ""} />
    <label>Categoria do problema<input name="category" defaultValue={rule?.category} required readOnly={readOnly} /></label>
    <label>Sinal de alerta<textarea name="signal" defaultValue={rule?.signal} required readOnly={readOnly} /></label>
    <label>Nível de prioridade<select name="priority" defaultValue={rule?.priority || "contact_surgeon"} required disabled={readOnly}><option value="home_guidance">Orientação domiciliar</option><option value="contact_surgeon">Contatar o cirurgião</option><option value="immediate_emergency">Emergência imediata</option></select></label>
    <label>Ação recomendada<textarea name="recommended_action" defaultValue={rule?.recommendedAction} required readOnly={readOnly} /></label>
    <label>Expressões similares para detecção<textarea name="similar_expressions" defaultValue={rule?.similarExpressions} placeholder="Uma expressão por linha" readOnly={readOnly} /></label>
  </>;
  if (readOnly) return <div className="drawer-form">{fields}<p className="muted-copy">Regra canônica versionada em public/redflags.csv. Use o controle abaixo para ativar ou inativar.</p></div>;
  return <form action={saveRedFlagRule} className="drawer-form">{fields}<button>Salvar regra</button></form>;
}
