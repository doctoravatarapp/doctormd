import Link from "next/link";
import { patientLogin } from "./actions";
import "../patient.css";

export default async function PatientLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="patient-login"><Link href="/" className="patient-logo"><span>A</span> APolloMD</Link><section><p className="patient-eyebrow">PORTAL DO PACIENTE</p><h1>Seu cuidado continua aqui.</h1><p>Acesse sua conversa de acompanhamento com segurança.</p>{error ? <div className="patient-error">{error === "access" ? "Esta conta ainda não está vinculada a um paciente ativo." : "E-mail ou senha inválidos."}</div> : null}<form action={patientLogin}><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label><button>Entrar</button></form><small>Este acesso é exclusivo para pacientes vinculados.</small></section></main>;
}
