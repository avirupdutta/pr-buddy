import { streamText, generateText, Output } from "ai";
import {
  createAIProviderRegistry,
  extractProviderFromModel,
  getProviderStructuredOutputCapabilities,
  modelSupportsJsonSchema,
} from "./ai-provider-registry";
import type { AIModel, GenerateResponse } from "@/types/chrome";
import type {
  PRResponse,
  StructuredOutputResult,
  StructuredOutputError,
  StructuredStreamEvent,
} from "@/types/structured-output";
import { PRResponseSchema } from "@/types/structured-output";

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
        cerebras: this.apiKeys.cerebrasKey
          ? { apiKey: this.apiKeys.cerebrasKey }
          : null,
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
        model: registry.languageModel(modelId as `${string}:${string}`),
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
    if (this.apiKeys.cerebrasKey) providers.push("cerebras");
    if (this.apiKeys.openRouterKey) providers.push("openrouter");
    return providers;
  }

  // Generate structured output for PR responses
  async generateStructuredText(
    params: AIRequestParams,
  ): Promise<StructuredOutputResult | StructuredOutputError> {
    const registry = this.initializeRegistry();
    const provider = extractProviderFromModel(params.model.modelId);
    const capabilities = getProviderStructuredOutputCapabilities(provider);
    const modelId = this.getModelIdentifier(params.model);

    // Check if the specific model supports JSON Schema
    const supportsJsonSchema = modelSupportsJsonSchema(
      params.model.modelId,
      provider,
    );

    try {
      // Only use native structured output if both provider and model support it
      if (capabilities.supportsNativeStructuredOutput && supportsJsonSchema) {
        // Use native structured output
        const result = await generateText({
          model: registry.languageModel(modelId),
          output: Output.object({
            schema: PRResponseSchema,
          }),
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
        });

        return {
          success: true,
          data: result.output as PRResponse,
          provider,
          model: params.model.modelId,
        };
      }

      // Fallback to JSON parsing for providers/models that don't support native structured output
      if (capabilities.fallbackToJSONParsing || !supportsJsonSchema) {
        return await this.generateWithJSONFallback(params, provider, modelId);
      }
    } catch (error) {
      // Check if it's a NoObjectGeneratedError and try fallback
      if (error instanceof Error && error.name === "NoObjectGeneratedError") {
        return await this.generateWithJSONFallback(params, provider, modelId);
      }

      return {
        success: false,
        error: `AI SDK Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        provider,
        model: params.model.modelId,
      };
    }

    // Default fallback
    return {
      success: false,
      error: "Provider does not support structured output",
      provider,
      model: params.model.modelId,
    };
  }

  // JSON fallback implementation for providers without native structured output
  private async generateWithJSONFallback(
    params: AIRequestParams,
    provider: string,
    modelId: string,
  ): Promise<StructuredOutputResult | StructuredOutputError> {
    const registry = this.initializeRegistry();

    try {
      const { text } = await generateText({
        model: registry.languageModel(modelId as `${string}:${string}`),
        messages: [
          {
            role: "system",
            content: `${params.systemPrompt}\n\nIMPORTANT: You must respond with valid JSON in this exact format:\n{\n  "title": "A concise PR title",\n  "description": "The full PR description in Markdown format"\n}`,
          },
          { role: "user", content: params.userPrompt },
        ],
      });

      // Try to parse JSON from the response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validated = PRResponseSchema.parse(parsed);

          return {
            success: true,
            data: validated,
            provider,
            model: params.model.modelId,
          };
        }
      } catch {
        // If JSON parsing fails, try to extract title and description from text
        const titleMatch = text.match(/TITLE: (.+?)(?=\n\nDESCRIPTION:|$)/s);
        const descriptionMatch = text.match(/DESCRIPTION: (.+?)$/s);

        if (descriptionMatch) {
          const result = {
            title: titleMatch ? titleMatch[1].trim() : undefined,
            description: descriptionMatch[1].trim(),
          };

          const validated = PRResponseSchema.parse(result);

          return {
            success: true,
            data: validated,
            provider,
            model: params.model.modelId,
          };
        }
      }

      // If all parsing fails, treat entire text as description
      const fallbackResult = {
        description: text.trim(),
      };

      const validated = PRResponseSchema.parse(fallbackResult);

      return {
        success: true,
        data: validated,
        provider,
        model: params.model.modelId,
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON fallback failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        provider,
        model: params.model.modelId,
      };
    }
  }

  // Generate structured output with streaming
  async *generateStructuredTextStream(
    params: AIRequestParams,
  ): AsyncGenerator<StructuredStreamEvent> {
    const registry = this.initializeRegistry();
    const provider = extractProviderFromModel(params.model.modelId);
    const capabilities = getProviderStructuredOutputCapabilities(provider);
    const modelId = this.getModelIdentifier(params.model);

    // Check if the specific model supports JSON Schema
    const supportsJsonSchema = modelSupportsJsonSchema(
      params.model.modelId,
      provider,
    );

    try {
      // Only use streaming structured output if both provider and model support it
      if (
        capabilities.supportsStreamingStructuredOutput &&
        supportsJsonSchema
      ) {
        // Use streaming structured output
        const result = await streamText({
          model: registry.languageModel(modelId as `${string}:${string}`),
          output: Output.object({
            schema: PRResponseSchema,
          }),
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
        });

        let accumulatedData: Partial<PRResponse> = {};

        for await (const partialObject of result.partialOutputStream) {
          // Accumulate the partial data
          accumulatedData = { ...accumulatedData, ...partialObject };

          yield {
            type: "partial",
            data: {
              ...accumulatedData,
              isComplete: false,
            },
          };
        }

        yield {
          type: "complete",
        };
      } else {
        // Fallback to regular text streaming for models that don't support JSON Schema
        const { textStream } = await streamText({
          model: registry.languageModel(modelId as `${string}:${string}`),
          messages: [
            {
              role: "system",
              content: `${params.systemPrompt}\n\nIMPORTANT: You must respond with valid JSON in this exact format:\n{\n  "title": "A concise PR title",\n  "description": "The full PR description in Markdown format"\n}`,
            },
            { role: "user", content: params.userPrompt },
          ],
        });

        let accumulatedText = "";

        for await (const chunk of textStream) {
          accumulatedText += chunk;
          yield {
            type: "partial",
            data: {
              description: accumulatedText,
              isComplete: false,
            },
          };
        }

        yield {
          type: "complete",
        };
      }
    } catch (error) {
      yield {
        type: "error",
        error: `AI SDK Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }
}

// Factory function to create AI SDK service instance
export function createAISDKService(
  apiKeys: Record<string, string>,
): AISDKService {
  return new AISDKService(apiKeys);
}
