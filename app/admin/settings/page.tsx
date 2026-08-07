import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import Link from "next/link";

export default function SettingsPage() {
  return <main className="admin-content"><PageHeader eyebrow="CONFIGURAÇÕES" title="Sua operação, do seu jeito." description="Preferências e regras operacionais da organização." /><section className="panel settings-links"><Link href="/admin/settings/red-flags"><strong>Regras de RED Flags</strong><span>Configurar termos explícitos e severidades →</span></Link></section><section className="panel"><EmptyState icon="⚙" title="Outras configurações" description="Novas opções serão liberadas conforme os módulos forem ativados." /></section></main>;
}
