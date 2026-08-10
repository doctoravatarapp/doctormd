"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const groups = [
  { label: "Operação", items: [{ href: "/admin", label: "Visão geral", icon: "⌂", exact: true }, { href: "/admin/operations", label: "Central", icon: "≡" }, { href: "/admin/patients", label: "Pacientes", icon: "○" }, { href: "/admin/conversations", label: "Conversas", icon: "◌" }, { href: "/admin/alerts", label: "Alertas", icon: "△" }] },
  { label: "Gestão", items: [{ href: "/admin/doctors", label: "Médicos", icon: "+" }, { href: "/admin/automations", label: "Automações", icon: "◇" }, { href: "/admin/team", label: "Equipe", icon: "◎" }] },
  { label: "Sistema", items: [{ href: "/admin/settings", label: "Configurações", icon: "⚙" }] },
];

export function Sidebar({ organizationName, email, userName, role, alertCount = 0, open, onClose }: { organizationName: string; email: string | null; userName: string; role: string; alertCount?: number; open: boolean; onClose: () => void }) {
  const path = usePathname();
  return <><button className={`sidebar-scrim ${open ? "open" : ""}`} aria-label="Fechar navegação" onClick={onClose} /><aside className={`admin-sidebar ${open ? "open" : ""}`} aria-label="Navegação principal">
    <div className="sidebar-brand-row"><Link className="brand admin-brand" href="/admin" onClick={onClose}><span className="brand-mark">A</span><span>APolloMD</span></Link><button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">×</button></div>
    <button className="organization-switcher" type="button"><span>{organizationName}</span><small>Organização atual</small><b>⌄</b></button>
    <nav className="sidebar-nav">{groups.map((group) => <section key={group.label}><p>{group.label}</p>{group.items.map((item) => { const active = item.exact ? path === item.href : path.startsWith(item.href); return <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href} onClick={onClose}><i aria-hidden>{item.icon}</i><span>{item.label}</span>{item.href === "/admin/alerts" && alertCount > 0 ? <b className="nav-count">{alertCount}</b> : null}</Link>; })}</section>)}</nav>
    <div className="sidebar-account"><span>{userName.slice(0, 2).toUpperCase()}</span><div><strong>{userName}</strong><small>{role} · {email}</small></div><form action={logout}><button type="submit" aria-label="Sair da conta">↗</button></form></div>
  </aside></>;
}
