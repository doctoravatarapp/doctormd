import Link from "next/link";
import { ChatPreview } from "@/components/chat-preview";
import { submitSalesLead } from "./lead-actions";

const benefits = [
  { number: "01", title: "Menos trabalho repetitivo", text: "Automatize acompanhamentos, coletas de informação e orientações recorrentes sem transformar o cuidado em respostas frias." },
  { number: "02", title: "Prioridades mais claras", text: "Sinais relevantes chegam organizados para a equipe. O médico concentra atenção em quem realmente precisa de intervenção." },
  { number: "03", title: "Mais presença na consulta", text: "Com o contexto do paciente organizado antes do contato, sobra mais tempo para escutar, decidir e cuidar." },
];

const steps = [
  { label: "Configure", title: "Seu protocolo, sua forma de cuidar", text: "Defina jornadas, perguntas, orientações e sinais de atenção de acordo com a rotina da sua equipe." },
  { label: "Acompanhe", title: "APolloMD mantém a conversa ativa", text: "O paciente recebe acompanhamento contínuo e responde no próprio ritmo, em uma experiência simples e acolhedora." },
  { label: "Decida", title: "A equipe entra com contexto", text: "Resumos, alertas e histórico ajudam o médico a agir mais rápido — sempre com autonomia sobre a conduta." },
];

const useCases = [
  ["Pós-operatório", "Acompanhe dor, evolução, adesão e sinais de atenção entre o procedimento e o retorno."],
  ["Tratamentos contínuos", "Mantenha proximidade, organize respostas e identifique mudanças relevantes ao longo da jornada."],
  ["Preparo e retorno", "Oriente o paciente antes da consulta e chegue ao encontro com informações mais completas."],
  ["Rotina da clínica", "Reduza mensagens dispersas e dê à equipe uma visão compartilhada de cada acompanhamento."],
];

const faqs = [
  ["A IA substitui o médico?", "Não. O APolloMD amplia a capacidade de acompanhamento da equipe. Decisões clínicas, condutas e intervenções continuam sob responsabilidade dos profissionais."],
  ["O atendimento fica robotizado?", "A proposta é justamente o oposto: retirar tarefas repetitivas para que médicos e equipes tenham mais tempo e contexto nas interações que exigem presença humana."],
  ["É possível adaptar aos protocolos da clínica?", "Sim. Jornadas, automações, perguntas e regras de atenção podem ser configuradas para refletir o modo de trabalho da organização."],
  ["Como o paciente acessa?", "O paciente utiliza um canal simples de acompanhamento, sem precisar aprender fluxos complexos. A equipe mantém a visão da jornada e assume a conversa quando necessário."],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  return (
    <main className="page-shell sales-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="APolloMD — início"><span className="brand-mark" aria-hidden="true">A</span><span>APolloMD</span></a>
        <nav className="site-nav" aria-label="Navegação principal"><a href="#beneficios">Benefícios</a><a href="#como-funciona">Como funciona</a><a href="#seguranca">Cuidado humano</a></nav>
        <nav className="access-nav" aria-label="Acessos"><Link className="access-link access-link-secondary" href="/login">Área médica</Link><a className="access-link" href="#demonstracao">Agendar demonstração</a></nav>
      </header>

      <section id="inicio" className="hero sales-hero">
        <div className="hero-copy">
          <p className="eyebrow">PRODUTIVIDADE CLÍNICA · CUIDADO HUMANO</p>
          <h1>Cuide de mais pacientes. <span>Continue presente.</span></h1>
          <p className="hero-description">O APolloMD amplia a capacidade de acompanhamento do médico com IA, automação e contexto — para reduzir tarefas repetitivas sem abrir mão de um atendimento próximo e humanizado.</p>
          <div className="hero-actions"><a className="access-link sales-primary" href="#demonstracao">Quero conhecer o APolloMD</a><a className="text-access-link" href="#como-funciona">Ver como funciona ↓</a></div>
          <div className="trust-line" aria-label="Diferenciais principais"><span>✓ Médico no controle</span><span>✓ Acompanhamento contínuo</span><span>✓ IA com supervisão humana</span></div>
        </div>
        <div className="hero-product"><div className="product-note"><strong>Mais contexto.</strong><span>Menos tempo procurando informação.</span></div><ChatPreview /></div>
      </section>

      <section className="problem-strip" aria-label="Proposta de valor"><p>Mais pacientes não precisam significar menos atenção.</p><strong>O APolloMD transforma acompanhamento em uma operação contínua, organizada e humana.</strong></section>

      <section id="beneficios" className="landing-section benefits-section">
        <div className="section-heading"><p className="eyebrow">TEMPO PARA O QUE EXIGE UM MÉDICO</p><h2>Produtividade que melhora o cuidado — não que acelera a consulta.</h2><p>Organize a jornada entre atendimentos e devolva à equipe tempo, clareza e capacidade de resposta.</p></div>
        <div className="benefit-grid">{benefits.map((benefit) => <article className="benefit-card" key={benefit.number}><span>{benefit.number}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div>
      </section>

      <section id="como-funciona" className="landing-section workflow-section">
        <div className="section-heading section-heading-light"><p className="eyebrow">SIMPLES PARA A EQUIPE. NATURAL PARA O PACIENTE.</p><h2>Uma camada inteligente entre a consulta e o próximo encontro.</h2></div>
        <div className="workflow-grid">{steps.map((step, index) => <article key={step.label}><div className="step-number">{String(index + 1).padStart(2, "0")}</div><small>{step.label}</small><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>

      <section id="seguranca" className="landing-section human-section">
        <div className="human-copy"><p className="eyebrow">TECNOLOGIA QUE SABE QUANDO CHAMAR UMA PESSOA</p><h2>A IA sustenta a rotina. O vínculo continua humano.</h2><p>APolloMD acompanha, organiza e sinaliza. Quando uma situação pede julgamento, acolhimento ou decisão clínica, a equipe assume a conversa com o histórico já estruturado.</p><ul><li><span>01</span><div><strong>Supervisão humana</strong><p>O médico mantém autonomia e visibilidade sobre cada acompanhamento.</p></div></li><li><span>02</span><div><strong>Transição com contexto</strong><p>A equipe entra na conversa sabendo o que aconteceu e por que sua atenção é necessária.</p></div></li><li><span>03</span><div><strong>Comunicação consistente</strong><p>Protocolos da organização orientam uma experiência clara, segura e alinhada.</p></div></li></ul></div>
        <aside className="human-proof"><p>“Produtividade não é atender mais rápido. É chegar ao paciente certo, no momento certo, com o contexto certo.”</p><div><span className="brand-mark">A</span><div><strong>Princípio APolloMD</strong><small>IA a serviço da relação médico-paciente</small></div></div></aside>
      </section>

      <section className="landing-section use-cases-section"><div className="section-heading"><p className="eyebrow">DA JORNADA PONTUAL AO CUIDADO CONTÍNUO</p><h2>Uma operação de acompanhamento para diferentes rotinas clínicas.</h2></div><div className="use-case-grid">{useCases.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

      <section className="landing-section difference-section"><div><p className="eyebrow">O RESULTADO NA ROTINA</p><h2>Menos fragmentação.<br />Mais capacidade de cuidar.</h2></div><div className="difference-list"><p><strong>Antes</strong><span>Mensagens dispersas, triagem manual e contexto reconstruído a cada contato.</span></p><p><strong>Com APolloMD</strong><span>Jornada organizada, prioridades visíveis e equipe preparada para agir.</span></p></div></section>

      <section className="landing-section faq-section"><div className="section-heading"><p className="eyebrow">PERGUNTAS FREQUENTES</p><h2>Clareza antes de começar.</h2></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

      <section id="demonstracao" className="landing-section lead-section">
        <div className="lead-copy"><p className="eyebrow">CONHEÇA O APOLLOMD</p><h2>Sua equipe mais produtiva.<br /><span>Seus pacientes mais acompanhados.</span></h2><p>Conte um pouco sobre sua operação. Nossa conversa será focada em como ampliar sua capacidade de acompanhamento sem perder a proximidade com o paciente.</p><div className="lead-assurance"><span>✓ Demonstração personalizada</span><span>✓ Sem compromisso</span><span>✓ Foco na rotina da sua equipe</span></div></div>
        <form action={submitSalesLead} className="lead-form">
          <div className="lead-form-heading"><strong>Agende uma conversa</strong><span>Retornaremos pelos contatos informados.</span></div>
          {lead === "success" ? <div className="lead-feedback success" role="status"><strong>Recebemos seu interesse.</strong><span>Obrigado! Entraremos em contato para combinar a demonstração.</span></div> : null}
          {lead === "validation" ? <div className="lead-feedback error" role="alert">Revise os campos obrigatórios e confirme o consentimento.</div> : null}
          {lead === "error" ? <div className="lead-feedback error" role="alert">Não foi possível enviar agora. Tente novamente em instantes.</div> : null}
          <div className="lead-form-grid"><label>Nome completo<input name="full_name" minLength={2} maxLength={120} autoComplete="name" required /></label><label>E-mail profissional<input name="email" type="email" maxLength={254} autoComplete="email" required /></label><label>WhatsApp<input name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="(00) 00000-0000" /></label><label>Clínica ou organização<input name="organization_name" maxLength={160} autoComplete="organization" /></label><label>Tamanho da equipe<select name="team_size" defaultValue="" required><option value="" disabled>Selecione</option><option value="solo">Somente eu</option><option value="2-5">2 a 5 pessoas</option><option value="6-15">6 a 15 pessoas</option><option value="16-50">16 a 50 pessoas</option><option value="51+">Mais de 50 pessoas</option></select></label><label>Principal objetivo<select name="primary_goal" defaultValue="" required><option value="" disabled>Selecione</option><option value="productivity">Aumentar produtividade</option><option value="follow-up">Melhorar acompanhamento</option><option value="patient-experience">Humanizar a experiência</option><option value="automation">Automatizar rotinas</option><option value="other">Outro</option></select></label></div>
          <label className="lead-consent"><input name="consent" type="checkbox" required /><span>Autorizo o contato do APolloMD sobre esta solicitação. Não envie informações de pacientes ou dados clínicos.</span></label>
          <label className="lead-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <button type="submit" className="access-link sales-primary">Quero uma demonstração</button>
          <small>Seus dados serão utilizados somente para responder a esta solicitação comercial.</small>
        </form>
      </section>

      <footer className="sales-footer"><a className="brand" href="#inicio"><span className="brand-mark">A</span><span>APolloMD</span></a><p>Produtividade clínica sem perder o cuidado humano.</p><nav><Link href="/patient/login">Acesso do paciente</Link><Link href="/login">Área médica</Link></nav></footer>
    </main>
  );
}
