import Link from "next/link";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const message = params.error === "access"
    ? "Sua conta ainda não possui acesso a uma organização."
    : params.error
      ? "E-mail ou senha inválidos."
      : null;

  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">A</span>
        <span>APolloMD</span>
      </Link>
      <section className="auth-card">
        <p className="eyebrow">ÁREA ADMINISTRATIVA</p>
        <h1>Bem-vindo de volta.</h1>
        <p>Acesse o ambiente seguro da sua organização.</p>
        {message ? <div className="auth-error" role="alert">{message}</div> : null}
        <form action={login} className="auth-form">
          <input type="hidden" name="next" value={params.next ?? "/admin"} />
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Entrar no APolloMD</button>
        </form>
        <small>Acesso restrito a profissionais autorizados.</small>
      </section>
    </main>
  );
}
