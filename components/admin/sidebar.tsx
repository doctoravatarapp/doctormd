import Link from "next/link";
import { logout } from "@/app/login/actions";

const navigation = [
  { href: "/admin", label: "Visão geral", icon: "⌂" },
  { href: "/admin/patients", label: "Pacientes", icon: "◎" },
  { href: "/admin/doctors", label: "Médicos", icon: "+" },
  { href: "/admin/conversations", label: "Conversas", icon: "◌" },
  { href: "/admin/alerts", label: "Alertas", icon: "△" },
  { href: "/admin/automations", label: "Automações", icon: "◇" },
  { href: "/admin/team", label: "Equipe", icon: "◉" },
  { href: "/admin/settings", label: "Configurações", icon: "⚙" },
];

export function Sidebar({ organizationName, email }: { organizationName: string; email: string | null }) {
  return (
    <aside className="admin-sidebar">
      <Link className="brand admin-brand" href="/admin">
        <span className="brand-mark">A</span>
        <span>APolloMD</span>
      </Link>
      <div className="organization-chip">
        <span>{organizationName.slice(0, 1).toUpperCase()}</span>
        <div><strong>{organizationName}</strong><small>Ambiente seguro</small></div>
      </div>
      <nav>
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}><span>{item.icon}</span>{item.label}</Link>
        ))}
      </nav>
      <div className="sidebar-account">
        <span>{email?.slice(0, 1).toUpperCase() ?? "U"}</span>
        <div><strong>{email ?? "Usuário"}</strong><small>Sessão autenticada</small></div>
        <form action={logout}><button type="submit" aria-label="Sair">↗</button></form>
      </div>
    </aside>
  );
}
