import Link from "next/link";
import { ChatPreview } from "@/components/chat-preview";

export default function Home() {
  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="APolloMD — início">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>APolloMD</span>
        </a>
        <nav className="access-nav" aria-label="Acessos">
          <Link className="access-link access-link-secondary" href="/login">Área médica</Link>
          <Link className="access-link" href="/patient/login">Entrar como paciente</Link>
        </nav>
      </header>

      <section id="inicio" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">CUIDADO CONECTADO · AI FIRST</p>
          <h1>
            O cuidado não termina quando a consulta <span>acaba.</span>
          </h1>
          <p className="hero-description">
            O APolloMD cria uma ponte conversacional contínua entre médicos e pacientes — simples,
            humana e preparada para cada etapa do acompanhamento.
          </p>

          <div className="hero-actions">
            <Link className="access-link" href="/patient/login">Acessar meu acompanhamento</Link>
            <Link className="text-access-link" href="/login">Sou profissional de saúde →</Link>
          </div>

          <div className="principles" aria-label="Princípios do produto">
            <div>
              <strong>24/7</strong>
              <span>Experiência contínua</span>
            </div>
            <div>
              <strong>Cloud</strong>
              <span>Seguro e escalável</span>
            </div>
            <div>
              <strong>Humano</strong>
              <span>Médico no controle</span>
            </div>
          </div>
        </div>

        <ChatPreview />
      </section>

      <footer>
        <span>APolloMD</span>
        <p>Canal seguro de acompanhamento entre pacientes e suas equipes.</p>
      </footer>
    </main>
  );
}
