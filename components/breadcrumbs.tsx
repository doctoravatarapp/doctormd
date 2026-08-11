"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  admin: "Visão geral",
  operations: "Central",
  patients: "Pacientes",
  doctors: "Médicos",
  conversations: "Conversas",
  alerts: "Alertas",
  automations: "Automações",
  episodes: "Acompanhamentos",
  team: "Equipe",
  settings: "Configurações",
  assistant: "Assistente de IA",
  "red-flags": "RED Flags",
  patient: "Acompanhamentos",
  chat: "Conversa",
  login: "Entrar",
  "set-password": "Ativar acesso",
};

function isIdentifier(segment: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d+$/.test(segment);
}

function labelFor(segment: string, parent?: string) {
  if (labels[segment]) return labels[segment];
  if (isIdentifier(segment)) {
    if (parent === "patients") return "Detalhe do paciente";
    if (parent === "doctors") return "Perfil do médico";
    if (parent === "team") return "Perfil de acesso";
    if (parent === "red-flags") return "Editar regra";
    if (parent === "conversations") return "Atendimento";
    if (parent === "automations") return "Editor do fluxo";
    if (parent === "episodes") return "Detalhe do acompanhamento";
    if (parent === "chat") return "Conversa";
    return "Detalhe";
  }
  return segment.replaceAll("-", " ").replace(/^./, (value) => value.toUpperCase());
}

export function Breadcrumbs({ currentLabel, className = "" }: { currentLabel?: string; className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  const patientLogin = pathname === "/patient/login";
  const root = segments[0] === "admin" ? "/admin" : segments[0] === "patient" && !patientLogin ? "/patient" : "/";
  const rootLabel = segments[0] === "admin" ? "Visão geral" : segments[0] === "patient" && !patientLogin ? "Acompanhamentos" : "Início";
  const crumbs = [{ href: root, label: rootLabel }];
  const start = root === "/" ? (patientLogin ? 1 : 0) : 1;

  for (let index = start; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    crumbs.push({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label: isLast && currentLabel ? currentLabel : labelFor(segment, segments[index - 1]),
    });
  }

  return <nav className={`app-breadcrumbs ${className}`.trim()} aria-label="Breadcrumb">
    <ol>{crumbs.map((crumb, index) => {
      const current = index === crumbs.length - 1;
      return <li key={`${crumb.href}-${index}`}>{index ? <span aria-hidden="true">/</span> : null}{current ? <span aria-current="page">{crumb.label}</span> : <Link href={crumb.href}>{crumb.label}</Link>}</li>;
    })}</ol>
  </nav>;
}
