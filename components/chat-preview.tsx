export function ChatPreview() {
  return (
    <div className="chat-card" aria-label="Prévia da experiência conversacional">
      <div className="chat-header">
        <div className="chat-doctor">
          <div className="doctor-avatar">AM</div>
          <div>
            <strong>Assistente APolloMD</strong>
            <span>Conectado ao seu médico</span>
          </div>
        </div>
        <span className="chat-security">Ambiente seguro</span>
      </div>

      <div className="chat-body">
        <div className="message message-assistant">
          Olá! Este é o novo canal de acompanhamento da sua equipe médica. Como você está se
          sentindo hoje?
          <small>APolloMD · agora</small>
        </div>

        <div className="message message-patient">
          Estou me sentindo bem e gostaria de saber os próximos passos.
          <small>Você · agora</small>
        </div>

        <div className="message message-assistant">
          Ótimo saber disso. Em breve, sua equipe poderá acompanhar cada etapa por aqui, sempre com
          supervisão humana.
          <small>APolloMD · agora</small>
        </div>

        <div className="chat-spacer" />

        <div className="chat-composer">
          <textarea aria-label="Mensagem" placeholder="Escreva sua mensagem..." disabled />
          <button type="button" aria-label="Enviar mensagem" disabled>
            ↑
          </button>
        </div>
        <p className="chat-disclaimer">Demonstração visual — atendimento ainda não habilitado.</p>
      </div>
    </div>
  );
}
