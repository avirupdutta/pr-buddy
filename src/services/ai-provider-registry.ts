import { createProviderRegistry } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Provider configuration interface
export interface AIProviderConfig {
  apiKey: string;
  provider?: string;
}

// Supported provider types
export type AIProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter";

// Provider-specific model mappings for reference
export const PROVIDER_MODEL_MAPPINGS = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  google: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
  groq: [
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
    "llama-3.1-70b-versatile",
  ],
  openrouter: [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-pro",
    "meta-llama/llama-3.1-70b-instruct",
  ],
} as const;

// Create provider registry with all supported providers
export function createAIProviderRegistry(
  configs: Record<AIProviderType, AIProviderConfig | null>,
) {
  const providers: Record<
    string,
    | ReturnType<typeof createOpenAI>
    | ReturnType<typeof createAnthropic>
    | ReturnType<typeof createGoogleGenerativeAI>
    | ReturnType<typeof createGroq>
    | ReturnType<typeof createOpenRouter>
  > = {};

  // Configure OpenAI
  if (configs.openai?.apiKey) {
    providers.openai = createOpenAI({
      apiKey: configs.openai.apiKey,
    });
  }

  // Configure Anthropic
  if (configs.anthropic?.apiKey) {
    providers.anthropic = createAnthropic({
      apiKey: configs.anthropic.apiKey,
    });
  }

  // Configure Google
  if (configs.google?.apiKey) {
    providers.google = createGoogleGenerativeAI({
      apiKey: configs.google.apiKey,
    });
  }

  // Configure Groq
  if (configs.groq?.apiKey) {
    providers.groq = createGroq({
      apiKey: configs.groq.apiKey,
    });
  }

  // Configure OpenRouter
  if (configs.openrouter?.apiKey) {
    providers.openrouter = createOpenRouter({
      apiKey: configs.openrouter.apiKey,
    });
  }

  return createProviderRegistry(providers);
}

// Get provider from model string
export function extractProviderFromModel(modelString: string): AIProviderType {
  if (modelString.includes("openai/") || modelString.startsWith("gpt-"))
    return "openai";
  if (modelString.includes("anthropic/") || modelString.startsWith("claude-"))
    return "anthropic";
  if (modelString.includes("google/") || modelString.startsWith("gemini-"))
    return "google";
  if (
    modelString.includes("groq/") ||
    modelString.startsWith("llama") ||
    modelString.startsWith("mixtral")
  )
    return "groq";
  if (modelString.includes("/") || modelString.includes("openrouter"))
    return "openrouter";

  // Default to openrouter for legacy models
  return "openrouter";
}

// Normalize model string for AI SDK
export function normalizeModelString(
  modelString: string,
  provider: AIProviderType,
): `${string}:${string}` {
  // Remove provider prefixes if they exist
  const cleanModel = modelString.replace(
    /^(openai|anthropic|google|groq|openrouter)\/|:/,
    "",
  );

  // Return provider-prefixed model for AI SDK (requires semicolon separator)
  return `${provider}:${cleanModel}` as `${string}:${string}`;
}

// Validate provider-model compatibility
export function validateProviderModel(
  provider: AIProviderType,
  model: string,
): boolean {
  const validModels = PROVIDER_MODEL_MAPPINGS[provider];

  // Check if model is in the list of known models for the provider
  if (validModels.some((validModel) => model.includes(validModel))) {
    return true;
  }

  // For OpenRouter, allow custom models (they use provider/model format)
  if (provider === "openrouter") {
    return true;
  }

  return false;
}
