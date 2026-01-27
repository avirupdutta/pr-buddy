import { streamText, generateText } from "ai";
import { createAIProviderRegistry } from "./ai-provider-registry";
import type { AIModel, GenerateResponse } from "@/types/chrome";

// Request parameters interface (matching existing implementation)
export interface AIRequestParams {
  model: AIModel;
  systemPrompt: string;
  userPrompt: string;
  stream?: boolean;
}

// Streaming response interface
export interface AIStreamResponse {
  title?: string;
  description?: string;
  error?: string;
  isComplete?: boolean;
}

// AI SDK Service Implementation
export class AISDKService {
  private providerRegistry: ReturnType<typeof createAIProviderRegistry> | null =
    null;
  private apiKeys: Record<string, string>;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
  }

  private initializeRegistry(): ReturnType<typeof createAIProviderRegistry> {
    if (!this.providerRegistry) {
      this.providerRegistry = createAIProviderRegistry({
        openai: this.apiKeys.openaiKey
          ? { apiKey: this.apiKeys.openaiKey }
          : null,
        anthropic: this.apiKeys.anthropicKey
          ? { apiKey: this.apiKeys.anthropicKey }
          : null,
        google: this.apiKeys.googleKey
          ? { apiKey: this.apiKeys.googleKey }
          : null,
        groq: this.apiKeys.groqKey ? { apiKey: this.apiKeys.groqKey } : null,
        openrouter: this.apiKeys.openRouterKey
          ? { apiKey: this.apiKeys.openRouterKey }
          : null,
      });
    }
    return this.providerRegistry;
  }

  private getModelIdentifier(model: AIModel): `${string}:${string}` {
    // For direct provider calls, use provider:modelId format
    const provider = model.provider || "openrouter";
    return `${provider}:${model.modelId}` as `${string}:${string}`;
  }

  async generateText(params: AIRequestParams): Promise<GenerateResponse> {
    const registry = this.initializeRegistry();

    try {
      const modelId = this.getModelIdentifier(params.model);

      const { text } = await generateText({
        model: registry.languageModel(modelId),
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
      });

      // Parse response for title and description (similar to existing format)
      const titleMatch = text.match(/TITLE: (.+?)(?=\n\nDESCRIPTION:|$)/s);
      const descriptionMatch = text.match(/DESCRIPTION: (.+?)$/s);

      const title = titleMatch ? titleMatch[1].trim() : "";
      const description = descriptionMatch ? descriptionMatch[1].trim() : text;

      return {
        success: true,
        description,
        title: title || undefined,
        prDetails: { owner: "", repo: "", number: "" }, // TODO: Pass actual PR details from caller
      };
    } catch (error) {
      throw new Error(
        `AI SDK Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async *generateTextStream(
    params: AIRequestParams,
  ): AsyncGenerator<AIStreamResponse> {
    const registry = this.initializeRegistry();

    try {
      const modelId = this.getModelIdentifier(params.model);

      const { textStream } = await streamText({
        model: registry.languageModel(modelId),
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
      });

      let accumulatedText = "";
      let isProcessingTitle = true;
      let title = "";
      let description = "";

      for await (const chunk of textStream) {
        accumulatedText += chunk;

        // Try to parse title and description from accumulated text
        const titleMatch = accumulatedText.match(
          /TITLE: (.+?)(?=\n\nDESCRIPTION:|$)/s,
        );
        const descriptionMatch = accumulatedText.match(/DESCRIPTION: (.+?)$/s);

        if (titleMatch && isProcessingTitle) {
          title = titleMatch[1].trim();
          isProcessingTitle = false;
        }

        if (descriptionMatch) {
          description = descriptionMatch[1].trim();
        }

        yield {
          title: title || undefined,
          description: description || accumulatedText,
          isComplete: false,
        };
      }

      // Final yield with complete data
      yield {
        title: title || undefined,
        description: description || accumulatedText,
        isComplete: true,
      };
    } catch (error) {
      yield {
        error: `AI SDK Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        isComplete: true,
      };
    }
  }

  // Check if service is properly configured
  isConfigured(): boolean {
    return Object.values(this.apiKeys).some(
      (key) => key && key.trim().length > 0,
    );
  }

  // Get available providers based on API keys
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.apiKeys.openaiKey) providers.push("openai");
    if (this.apiKeys.anthropicKey) providers.push("anthropic");
    if (this.apiKeys.googleKey) providers.push("google");
    if (this.apiKeys.groqKey) providers.push("groq");
    if (this.apiKeys.openRouterKey) providers.push("openrouter");
    return providers;
  }
}

// Factory function to create AI SDK service instance
export function createAISDKService(
  apiKeys: Record<string, string>,
): AISDKService {
  return new AISDKService(apiKeys);
}
