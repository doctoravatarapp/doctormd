import { PageHeader } from "@/components/admin/page-header";
import { SettingsNav } from "@/components/admin/settings-nav";
import { getAdminContext } from "@/lib/auth/context";

export default async function SettingsPage() {
  const context = await getAdminContext();
  return <main className="admin-content"><PageHeader eyebrow="SISTEMA" title="Configurações" description="Preferências da organização e do atendimento." /><div className="settings-layout"><SettingsNav active="Geral" /><section className="settings-content"><article className="panel"><h2>Geral</h2><p className="muted-copy">Informações principais do ambiente APolloMD.</p><dl className="settings-definition"><div><dt>Organização</dt><dd>{context.organization?.name}</dd></div><div><dt>Identificador</dt><dd>{context.organization?.slug}</dd></div><div><dt>Seu papel</dt><dd>{context.role}</dd></div></dl></article><article className="panel" id="organization"><h2>Segurança da organização</h2><p className="muted-copy">Preferências operacionais nunca substituem autorização, RLS ou regras de segurança.</p></article></section></div></main>;
}
