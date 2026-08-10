"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function AdminShell({ children, ...sidebar }: { children: React.ReactNode; organizationName: string; email: string | null; userName: string; role: string; alertCount: number }) {
  const [open, setOpen] = useState(false);
  const path=usePathname();const page=path.startsWith("/admin/operations")?"Central":path.startsWith("/admin/patients")?"Pacientes":path.startsWith("/admin/doctors")?"Médicos":path.startsWith("/admin/conversations")?"Conversas":path.startsWith("/admin/alerts")?"Alertas":path.startsWith("/admin/automations")?"Automações":path.startsWith("/admin/team")?"Equipe":path.startsWith("/admin/settings")?"Configurações":"Visão geral";
  return <div className="admin-shell"><Sidebar {...sidebar} open={open} onClose={() => setOpen(false)} /><div className="admin-main"><header className="mobile-admin-bar"><button onClick={() => setOpen(true)} aria-label="Abrir navegação">☰</button><strong>{page}</strong><span>{sidebar.organizationName}</span></header>{children}</div></div>;
}
