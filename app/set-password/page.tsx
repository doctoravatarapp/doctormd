import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setInvitedPassword } from "./actions";
import "../patient/patient.css";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session");
  const { error } = await searchParams;
  return <main className="patient-login"><span className="patient-logo"><b>A</b> APolloMD</span><section><p className="patient-eyebrow">ATIVAR ACESSO</p><h1>Defina sua senha.</h1><p>Use pelo menos 12 caracteres para proteger seu acesso administrativo.</p>{error ? <div className="patient-error">{error === "validation" ? "As senhas devem coincidir e ter pelo menos 12 caracteres." : "Não foi possível salvar a senha. Tente novamente."}</div> : null}<form action={setInvitedPassword}><label>Nova senha<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label><label>Confirmar senha<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label><button>Ativar meu acesso</button></form></section></main>;
}
