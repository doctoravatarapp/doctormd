import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";

export default function SettingsPage() {
  return <main className="admin-content"><PageHeader eyebrow="CONFIGURAÇÕES" title="Sua operação, do seu jeito." description="Preferências da organização e do agente serão centralizadas aqui." /><section className="panel"><EmptyState icon="⚙" title="Configuração protegida" description="Novas opções serão liberadas conforme os módulos do produto forem ativados." /></section></main>;
}
