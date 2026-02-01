import { createProviderRegistry } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createCerebras } from "@ai-sdk/cerebras";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ProviderCapabilities } from "../types/structured-output";
import modelMappings from "@/data/model-mappings.json";

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
  | "cerebras"
  | "openrouter";

// Generate PROVIDER_MODEL_MAPPINGS dynamically from model-mappings.json
function generateProviderModelMappings(): Record<AIProviderType, string[]> {
  const mappings: Record<AIProviderType, string[]> = {
    openai: [],
    anthropic: [],
    google: [],
    groq: [],
    cerebras: [],
    openrouter: [],
  };

  for (const [providerId, providerData] of Object.entries(
    modelMappings.providers,
  )) {
    const provider = providerId as AIProviderType;
    if (provider in mappings) {
      mappings[provider] = providerData.models.map((m) => m.modelId);
    }
  }

  return mappings;
}

// Provider-specific model mappings from model-mappings.json
export const PROVIDER_MODEL_MAPPINGS = generateProviderModelMappings();

// Structured output capabilities per provider
export const PROVIDER_STRUCTURED_OUTPUT_CAPABILITIES: Record<
  AIProviderType,
  ProviderCapabilities
> = {
  openai: {
    supportsNativeStructuredOutput: true,
    fallbackToJSONParsing: false,
    supportsStreamingStructuredOutput: true,
  },
  anthropic: {
    supportsNativeStructuredOutput: false, // Anthropic doesn't support structured output natively
    fallbackToJSONParsing: true,
    supportsStreamingStructuredOutput: false,
  },
  google: {
    supportsNativeStructuredOutput: true, // Google supports structured output
    fallbackToJSONParsing: false,
    supportsStreamingStructuredOutput: true,
  },
  groq: {
    supportsNativeStructuredOutput: true, // Groq supports structured output
    fallbackToJSONParsing: false,
    supportsStreamingStructuredOutput: true,
  },
  cerebras: {
    supportsNativeStructuredOutput: true, // Cerebras supports structured output
    fallbackToJSONParsing: false,
    supportsStreamingStructuredOutput: true,
  },
  openrouter: {
    supportsNativeStructuredOutput: true, // OpenRouter supports structured output
    fallbackToJSONParsing: false,
    supportsStreamingStructuredOutput: true,
  },
};

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
    | ReturnType<typeof createCerebras>
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
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  // Configure Cerebras
  if (configs.cerebras?.apiKey) {
    providers.cerebras = createCerebras({
      apiKey: configs.cerebras.apiKey,
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
    (modelString.startsWith("llama") && modelString.includes("versatile"))
  )
    return "groq";
  if (
    modelString.includes("cerebras/") ||
    modelString.includes("llama-3.3") ||
    modelString.includes("llama3.1")
  )
    return "cerebras";
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
  // Return provider-prefixed model for AI SDK (requires semicolon separator)
  return `${provider}:${modelString}` as `${string}:${string}`;
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

  // For OpenRouter and Cerebras, allow custom models (they use provider/model format or runtime additions)
  if (provider === "openrouter" || provider === "cerebras") {
    return true;
  }

  return false;
}

// Get structured output capabilities for a provider
export function getProviderStructuredOutputCapabilities(
  provider: AIProviderType,
): ProviderCapabilities {
  return PROVIDER_STRUCTURED_OUTPUT_CAPABILITIES[provider];
}

// Check if a provider supports native structured output
export function supportsNativeStructuredOutput(
  provider: AIProviderType,
): boolean {
  return PROVIDER_STRUCTURED_OUTPUT_CAPABILITIES[provider]
    .supportsNativeStructuredOutput;
}

// Check if a provider needs fallback to JSON parsing
export function needsFallbackToJSONParsing(provider: AIProviderType): boolean {
  return PROVIDER_STRUCTURED_OUTPUT_CAPABILITIES[provider]
    .fallbackToJSONParsing;
}

// Check if a provider supports streaming structured output
export function supportsStreamingStructuredOutput(
  provider: AIProviderType,
): boolean {
  return PROVIDER_STRUCTURED_OUTPUT_CAPABILITIES[provider]
    .supportsStreamingStructuredOutput;
}
