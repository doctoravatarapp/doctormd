import "server-only";
export const AI_CONFIG = {
  model: process.env.OPENAI_MODEL || "gpt-5-mini",
  maxInputCharacters: 2000,
  historyMessages: 20, // limite explícito: evita histórico infinito e custo imprevisível
  rateWindowMinutes: 5,
  rateMaxMessages: 10,
  generationLockSeconds: 120,
} as const;
