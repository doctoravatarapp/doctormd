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
        <span className="status-pill">
          <span className="status-dot" /> Ambiente cloud operacional
        </span>
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
        <p>Infraestrutura inicial validada. Funcionalidades clínicas ainda não estão ativas.</p>
      </footer>
    </main>
  );
}
