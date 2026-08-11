import { saveRedFlagRule } from "@/app/admin/settings/red-flags/actions";

type Rule = { id: string; name: string; description: string | null; severity: string; pattern: string };

export function RedFlagRuleForm({ rule }: { rule?: Rule }) {
  return <form action={saveRedFlagRule} className="drawer-form">
    <input type="hidden" name="id" value={rule?.id || ""} />
    <label>Nome<input name="name" defaultValue={rule?.name} required /></label>
    <label>Termo ou expressão<input name="pattern" defaultValue={rule?.pattern} required /></label>
    <label>Descrição<input name="description" defaultValue={rule?.description || ""} /></label>
    <label>Severidade<select name="severity" defaultValue={rule?.severity || "medium"}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
    <button>Salvar regra</button>
  </form>;
}
