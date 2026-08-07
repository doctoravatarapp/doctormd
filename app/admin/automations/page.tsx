import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";

export default function AutomationsPage() {
  return <main className="admin-content"><PageHeader eyebrow="AUTOMAÇÕES" title="Jornadas que respeitam cada contexto." description="A fundação para fluxos configuráveis será construída em uma fase dedicada." /><section className="panel"><EmptyState icon="◇" title="Em breve" description="Nenhuma automação foi criada. O workflow engine ainda não está ativo." /></section></main>;
}
