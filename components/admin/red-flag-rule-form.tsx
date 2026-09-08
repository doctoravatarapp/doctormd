import { saveRedFlagRule } from "@/app/admin/settings/red-flags/actions";

type Rule = { id: string; category: string; signal: string; priority: string; recommendedAction: string; similarExpressions: string };

export function RedFlagRuleForm({ rule }: { rule?: Rule }) {
  const fields = <>
    <input type="hidden" name="id" value={rule?.id || ""} />
    <label>Categoria do problema<input name="category" defaultValue={rule?.category} required /></label>
    <label>Sinal de alerta<textarea name="signal" defaultValue={rule?.signal} required /></label>
    <label>Nível de prioridade<select name="priority" defaultValue={rule?.priority || "contact_surgeon"} required><option value="home_guidance">Orientação domiciliar</option><option value="contact_surgeon">Contatar o cirurgião</option><option value="immediate_emergency">Emergência imediata</option></select></label>
    <label>Ação recomendada<textarea name="recommended_action" defaultValue={rule?.recommendedAction} required /></label>
    <label>Expressões similares para detecção<textarea name="similar_expressions" defaultValue={rule?.similarExpressions} placeholder="Uma expressão por linha" /></label>
  </>;
  return <form action={saveRedFlagRule} className="drawer-form">{fields}<button>Salvar regra</button></form>;
}
