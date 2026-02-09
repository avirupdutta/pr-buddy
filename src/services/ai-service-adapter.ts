import { createAISDKService } from "./ai-sdk-service";
import { decryptApiKey } from "./encryption";
import { getStorage } from "./chrome-storage";
import type { AIModel } from "@/types/chrome";

// Request parameters interface (matching existing implementation)
export interface AIRequestParams {
  model: AIModel;
  systemPrompt: string;
  userPrompt: string;
  stream?: boolean;
}

// Response interfaces (matching existing implementation)
export interface GenerateResponse {
  success: true;
  description: string;
  title?: string;
  prDetails: { owner: string; repo: string; number: string };
}

export interface StreamChunk {
  type: "chunk" | "complete" | "error";
  content?: string;
  title?: string;
  error?: string;
  data?: GenerateResponse;
}

// Feature flag for gradual migration
const USE_AI_SDK = true; // Enable AI SDK for multi-provider support

/**
 * Service Adapter Layer
 * Routes requests between existing OpenRouter implementation and new AI SDK implementation
 */
export class AIServiceAdapter {
  private aiSDKService: {
    generateText: (params: AIRequestParams) => Promise<GenerateResponse>;
    generateTextStream: (params: AIRequestParams) => AsyncGenerator<
      {
        title?: string;
        description?: string;
        error?: string;
        isComplete?: boolean;
      },
      void,
      unknown
    >;
    isConfigured: () => boolean;
    getAvailableProviders: () => string[];
  } | null = null;
  private legacyService: {
    generateText: (
      params: AIRequestParams & { apiKey?: string },
    ) => Promise<GenerateResponse>;
    generateTextStream: (
      params: AIRequestParams & { apiKey?: string },
    ) => AsyncGenerator<StreamChunk, void, unknown>;
  } | null = null;

  constructor() {
    // Initialize adapter but don't create services until needed
  }

  private async getAIKeys() {
    try {
      const result = await getStorage([
        "openRouterKey",
        "openaiKey",
        "anthropicKey",
        "googleKey",
        "groqKey",
        "cerebrasKey",
      ]);

      return {
        openRouterKey: result.openRouterKey
          ? await decryptApiKey(result.openRouterKey)
          : null,
        openaiKey: result.openaiKey
          ? await decryptApiKey(result.openaiKey)
          : null,
        anthropicKey: result.anthropicKey
          ? await decryptApiKey(result.anthropicKey)
          : null,
        googleKey: result.googleKey
          ? await decryptApiKey(result.googleKey)
          : null,
        groqKey: result.groqKey ? await decryptApiKey(result.groqKey) : null,
        cerebrasKey: result.cerebrasKey
          ? await decryptApiKey(result.cerebrasKey)
          : null,
      };
    } catch (error) {
      console.error("Failed to get AI keys:", error);
      return {};
    }
  }

  private shouldUseAISDK(
    model: AIModel,
    keys: Record<string, string | null>,
  ): boolean {
    if (!USE_AI_SDK) return false;

    const provider = model.provider || "openrouter";

    switch (provider) {
      case "openai":
        return Boolean(keys.openaiKey);
      case "anthropic":
        return Boolean(keys.anthropicKey);
      case "google":
        return Boolean(keys.googleKey);
      case "groq":
        return Boolean(keys.groqKey);
      case "cerebras":
        return Boolean(keys.cerebrasKey);
      case "openrouter":
      default:
        return Boolean(keys.openRouterKey);
    }
  }

  private getAIKeyForProvider(
    provider: string,
    keys: Record<string, string | null>,
  ): string | null {
    switch (provider) {
      case "openai":
        return keys.openaiKey;
      case "anthropic":
        return keys.anthropicKey;
      case "google":
        return keys.googleKey;
      case "groq":
        return keys.groqKey;
      case "cerebras":
        return keys.cerebrasKey;
      case "openrouter":
      default:
        return keys.openRouterKey;
    }
  }

  private async initializeAIKeys(): Promise<Record<string, string>> {
    const keys = await this.getAIKeys();
    const filteredKeys: Record<string, string> = {};

    // Filter out null values and convert to Record<string, string>
    Object.entries(keys).forEach(([key, value]) => {
      if (value) {
        filteredKeys[key] = value;
      }
    });

    return filteredKeys;
  }

  private async getAISDKService() {
    if (!this.aiSDKService) {
      const keys = await this.initializeAIKeys();
      this.aiSDKService = createAISDKService(keys);
    }
    return this.aiSDKService;
  }

  private async getLegacyService() {
    if (!this.legacyService) {
      // For now, return a placeholder since we can't easily import from background script
      // In actual implementation, this would be replaced with dynamic import
      this.legacyService = {
        generateText: async () => {
          throw new Error(
            "Legacy service not implemented in adapter - use background script functions",
          );
        },
        generateTextStream: async function* () {
          yield {
            type: "error",
            error: "Legacy service not implemented in adapter",
          };
        },
      };
    }
    return this.legacyService;
  }

  async generateText(params: AIRequestParams): Promise<GenerateResponse> {
    const keys = await this.initializeAIKeys();

    if (this.shouldUseAISDK(params.model, keys)) {
      try {
        const service = await this.getAISDKService();
        return await service.generateText(params);
      } catch (error) {
        console.error("AI SDK service failed, falling back to legacy:", error);
        // Fallback to legacy service
        const legacy = await this.getLegacyService();
        return await legacy.generateText({
          ...params,
          apiKey:
            this.getAIKeyForProvider(
              params.model.provider || "openrouter",
              keys,
            ) || undefined,
        });
      }
    } else {
      // Use legacy service
      const legacy = await this.getLegacyService();
      return await legacy.generateText({
        ...params,
        apiKey:
          this.getAIKeyForProvider(
            params.model.provider || "openrouter",
            keys,
          ) || undefined,
      });
    }
  }

  async *generateTextStream(
    params: AIRequestParams,
  ): AsyncGenerator<StreamChunk> {
    const keys = await this.initializeAIKeys();

    if (this.shouldUseAISDK(params.model, keys)) {
      try {
        const service = await this.getAISDKService();
        for await (const chunk of service.generateTextStream(params)) {
          if (chunk.error) {
            yield {
              type: "error",
              error: chunk.error,
            };
          } else if (chunk.isComplete) {
            yield {
              type: "complete",
              title: chunk.title,
              content: chunk.description,
              data: {
                success: true,
                description: chunk.description || "",
                title: chunk.title,
                prDetails: { owner: "", repo: "", number: "" }, // TODO: Pass actual PR details from caller
              },
            };
          } else {
            yield {
              type: "chunk",
              content: chunk.description,
              title: chunk.title,
            };
          }
        }
      } catch (error) {
        console.error("AI SDK stream failed, falling back to legacy:", error);
        // Fallback to legacy service
        const legacy = await this.getLegacyService();

        for await (const chunk of legacy.generateTextStream({
          ...params,
          apiKey:
            this.getAIKeyForProvider(
              params.model.provider || "openrouter",
              keys,
            ) || undefined,
        })) {
          yield chunk;
        }
      }
    } else {
      // Use legacy service
      const legacy = await this.getLegacyService();

      for await (const chunk of legacy.generateTextStream({
        ...params,
        apiKey:
          this.getAIKeyForProvider(
            params.model.provider || "openrouter",
            keys,
          ) || undefined,
      })) {
        yield chunk;
      }
    }
  }

  // Method to switch between services (for testing)
  setUseAISDK(enabled: boolean) {
    // This would be used by a feature flag UI later
    (
      globalThis as { AI_SERVICE_ADAPTER_FLAG?: boolean }
    ).AI_SERVICE_ADAPTER_FLAG = enabled;
  }

  // Method to check which service is being used
  getServiceType(): "ai-sdk" | "legacy" {
    return USE_AI_SDK ? "ai-sdk" : "legacy";
  }
}

// Singleton instance
export const aiServiceAdapter = new AIServiceAdapter();

// Export functions that match existing interface
export const generateWithAIAdapter = (params: AIRequestParams) =>
  aiServiceAdapter.generateText(params);

export const generateWithAIAdapterStream = (params: AIRequestParams) =>
  aiServiceAdapter.generateTextStream(params);
