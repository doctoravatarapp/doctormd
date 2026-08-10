import "server-only";
export const AI_CONFIG = {
  responseModel: process.env.AI_RESPONSE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
  classifierModel: process.env.AI_CLASSIFIER_MODEL || "gpt-5-mini",
  semanticReviewThreshold: Number(process.env.SEMANTIC_REVIEW_THRESHOLD || "0.82"),
  classifierTimeoutMs: 8000,
  maxInputCharacters: 2000,
  historyMessages: 20, // limite explícito: evita histórico infinito e custo imprevisível
  rateWindowMinutes: 5,
  rateMaxMessages: 10,
  generationLockSeconds: 120,
} as const;
