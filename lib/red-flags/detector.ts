export type RedFlagPriority = "home_guidance" | "contact_surgeon" | "immediate_emergency";

export type RedFlagConfiguration = {
  schema_version?: number;
  source?: string;
  code?: string;
  category?: string;
  priority?: RedFlagPriority;
  recommended_action?: string;
  match_type?: string;
  pattern?: string;
  matcher?: {
    phrases?: string[];
    groups?: string[][];
    exclude?: string[];
  };
};

export type RedFlagRuleCandidate = {
  id: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  configuration: unknown;
};

export type MatchedRedFlagRule = RedFlagRuleCandidate & {
  configuration: RedFlagConfiguration;
  priority: RedFlagPriority;
};

export const RED_FLAG_PRIORITY_RANK: Record<RedFlagPriority, number> = {
  home_guidance: 1,
  contact_surgeon: 2,
  immediate_emergency: 3,
};

export function normalizeClinicalText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9°]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(content: string, term: string) {
  const normalized = normalizeClinicalText(term);
  return normalized.length >= 2 && content.includes(normalized);
}

function isPriority(value: unknown): value is RedFlagPriority {
  return value === "home_guidance" || value === "contact_surgeon" || value === "immediate_emergency";
}

function priorityFor(configuration: RedFlagConfiguration, severity: RedFlagRuleCandidate["severity"]): RedFlagPriority {
  if (isPriority(configuration.priority)) return configuration.priority;
  if (severity === "critical") return "immediate_emergency";
  if (severity === "high") return "contact_surgeon";
  return "home_guidance";
}

export function matchesRedFlagConfiguration(content: string, rawConfiguration: unknown) {
  const configuration = (rawConfiguration && typeof rawConfiguration === "object" ? rawConfiguration : {}) as RedFlagConfiguration;
  const normalizedContent = normalizeClinicalText(content);
  if (!normalizedContent) return false;

  if (configuration.match_type === "contains" && configuration.pattern) {
    return includesTerm(normalizedContent, configuration.pattern);
  }

  const matcher = configuration.matcher;
  if (!matcher) return false;
  if (matcher.exclude?.some((term) => includesTerm(normalizedContent, term))) return false;

  const phraseMatch = matcher.phrases?.some((phrase) => includesTerm(normalizedContent, phrase)) ?? false;
  const groupMatch = Boolean(matcher.groups?.length) && matcher.groups!.every(
    (alternatives) => alternatives.some((term) => includesTerm(normalizedContent, term)),
  );
  return phraseMatch || groupMatch;
}

export function matchRedFlagRules(content: string, rules: RedFlagRuleCandidate[]): MatchedRedFlagRule[] {
  return rules
    .filter((rule) => matchesRedFlagConfiguration(content, rule.configuration))
    .map((rule) => {
      const configuration = rule.configuration as RedFlagConfiguration;
      return { ...rule, configuration, priority: priorityFor(configuration, rule.severity) };
    })
    .sort((a, b) => RED_FLAG_PRIORITY_RANK[b.priority] - RED_FLAG_PRIORITY_RANK[a.priority]);
}

export function asMatchedRedFlagRule(rule: RedFlagRuleCandidate): MatchedRedFlagRule {
  const configuration = rule.configuration as RedFlagConfiguration;
  return { ...rule, configuration, priority: priorityFor(configuration, rule.severity) };
}

export function patientMessageForRedFlag(rule: MatchedRedFlagRule) {
  return rule.configuration.recommended_action || "Siga as orientações já fornecidas pela equipe e continue observando a evolução.";
}

export function redFlagConfirmationPrompt(rule: MatchedRedFlagRule) {
  return `Identificamos no seu relato este possível sinal de alerta: “${rule.name}”. Isso está acontecendo com você agora? Confirme com Sim ou Não.`;
}

export function parseConfirmationAnswer(value: string): "confirmed" | "rejected" | null {
  const normalized = normalizeClinicalText(value);
  if (["sim", "s", "confirmo", "isso", "isso mesmo", "esta", "esta acontecendo"].includes(normalized)) return "confirmed";
  if (["nao", "n", "negativo", "nao esta", "nao acontece"].includes(normalized)) return "rejected";
  return null;
}
