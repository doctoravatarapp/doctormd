import{AI_CONFIG}from"./config";import type{Classification}from"./classifier";
export type AiPolicyDecision="ALLOW_AI_RESPONSE"|"REQUEST_HUMAN_REVIEW"|"BLOCK_AUTOMATIC_RESPONSE";
export function decideAiPolicy(input:{conversationMode:string;classification:Classification}):AiPolicyDecision{if(input.conversationMode!=="ai")return"BLOCK_AUTOMATIC_RESPONSE";if(input.classification.category==="possible_concern"&&input.classification.needsHumanReview&&input.classification.confidence>=AI_CONFIG.semanticReviewThreshold)return"REQUEST_HUMAN_REVIEW";return"ALLOW_AI_RESPONSE"}
