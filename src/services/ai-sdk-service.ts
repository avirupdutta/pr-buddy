import { streamText, generateText, Output } from "ai";
import {
  createAIProviderRegistry,
  extractProviderFromModel,
  getProviderStructuredOutputCapabilities,
  modelSupportsJsonSchema,
  getModelReasoningEffort,
} from "./ai-provider-registry";
import type { AIModel, GenerateResponse } from "@/types/chrome";
import type {
  PRResponse,
  StructuredOutputResult,
  StructuredOutputError,
  StructuredStreamEvent,
} from "@/types/structured-output";
import { PRResponseSchema } from "@/types/structured-output";

function truncateForUI(text: string, max = 1600): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)) + "...";
}

function extractProviderErrorMessageFromBody(body: unknown): string | null {
  if (!body) return null;

  // Body might already be an object
  if (typeof body === "object") {
    const maybe = body as Record<string, unknown>;
    const err = maybe.error as Record<string, unknown> | undefined;
    const message = (err?.message ?? maybe.message) as unknown;
    return typeof message === "string" && message.trim() ? message.trim() : null;
  }

  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  // Try parse JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return extractProviderErrorMessageFromBody(parsed);
    } catch {
      // fall through
    }
  }

  return trimmed;
}

function extractNestedErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    const obj = current as Record<string, unknown>;

    const directMessage =
      typeof obj.message === "string" && obj.message.trim()
        ? obj.message.trim()
        : null;
    if (directMessage && !/^\[object Object\]$/i.test(directMessage)) {
      return directMessage;
    }

    const providerMessage = extractProviderErrorMessageFromBody(
      obj.error ?? obj.body ?? obj.responseBody,
    );
    if (providerMessage) return providerMessage;

    const nestedCandidates = [
      obj.cause,
      obj.error,
      obj.response,
      obj.data,
      obj.value,
    ];
    for (const candidate of nestedCandidates) {
      if (candidate && typeof candidate === "object") queue.push(candidate);
    }
  }

  return null;
}

function formatAISDKErrorMessage(error: unknown): string {
  const seen = new Set<unknown>();

  const unwrap = (err: unknown): unknown => {
    if (!err || typeof err !== "object") return err;
    if (seen.has(err)) return err;
    seen.add(err);

    const anyErr = err as Record<string, unknown>;
    return anyErr.cause && typeof anyErr.cause === "object" ? anyErr.cause : err;
  };

  const err = unwrap(error);

  const anyErr = (err && typeof err === "object" ? (err as Record<string, unknown>) : null);
  const status =
    (anyErr?.statusCode as number | undefined) ??
    (anyErr?.status as number | undefined);
  const url = typeof anyErr?.url === "string" ? (anyErr.url as string) : undefined;
  const responseBody =
    anyErr?.responseBody ??
    anyErr?.body ??
    (anyErr?.response as Record<string, unknown> | undefined)?.body;

  const bodyMessage = extractProviderErrorMessageFromBody(responseBody);

  let message = "";
  if (bodyMessage) {
    message = bodyMessage;
  } else {
    const nestedMessage = extractNestedErrorMessage(err);
    if (nestedMessage) {
      message = nestedMessage;
    }
  }

  if (!message) {
    const errorCode = typeof anyErr?.code === "string" ? anyErr.code : "";
    const errorType = typeof anyErr?.type === "string" ? anyErr.type : "";
    const hint = [errorType, errorCode].filter(Boolean).join("/");
    if (hint) {
      message = `Request failed (${hint})`;
    }
  }

  if (!message) {
    const statusText =
      typeof anyErr?.statusText === "string" ? anyErr.statusText : "";
    if (statusText) message = statusText;
  }

  if (!message) {
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof anyErr?.message === "string") {
      message = anyErr.message as string;
    } else {
      message = "Unknown error";
    }
  }

  message = message.replace(/^AI SDK Error:\s*/i, "").trim();

  const parts: string[] = [];
  if (typeof status === "number") parts.push(`HTTP ${status}`);
  if (url) parts.push(url);
  parts.push(message);

  return truncateForUI(parts.filter(Boolean).join(": "));
}

/**
 * Helper function to strip markdown code blocks from text
 * Handles both ```json and ``` code blocks
 */
function stripMarkdownCodeBlocks(text: string): string {
  // Match code blocks with optional language specifier
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text;
}

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
      const modelProvider = params.model.provider || "openrouter";

      // DEBUG: Log reasoning effort lookup
      const reasoningEffort = getModelReasoningEffort(
        params.model.modelId,
        modelProvider,
      );
      console.log("[DEBUG generateText] Model:", params.model.modelId);
      console.log("[DEBUG generateText] Provider:", modelProvider);
      console.log("[DEBUG generateText] Reasoning Effort:", reasoningEffort);

      const { text } = await generateText({
        model: registry.languageModel(modelId as `${string}:${string}`),
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        // Apply reasoning effort from model configuration if specified
        ...(reasoningEffort && {
          providerOptions: {
            [modelProvider]: {
              reasoningEffort: reasoningEffort,
            },
          },
        }),
      });

      // DEBUG: Log the actual request options being sent
      console.log("[DEBUG generateText] Request options:", {
        model: modelId,
        provider: modelProvider,
        reasoningEffort: reasoningEffort,
        providerOptions: reasoningEffort
          ? { [modelProvider]: { reasoningEffort } }
          : undefined,
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
      throw new Error(`AI SDK Error: ${formatAISDKErrorMessage(error)}`);
    }
  }

  async *generateTextStream(
    params: AIRequestParams,
  ): AsyncGenerator<AIStreamResponse> {
    const registry = this.initializeRegistry();

    try {
      const modelId = this.getModelIdentifier(params.model);
      const modelProvider = params.model.provider || "openrouter";

      // Get reasoning effort from model configuration if specified
      const reasoningEffort = getModelReasoningEffort(
        params.model.modelId,
        modelProvider,
      );

      const { textStream } = await streamText({
        model: registry.languageModel(modelId),
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        // Apply reasoning effort from model configuration if specified
        ...(reasoningEffort && {
          providerOptions: {
            [modelProvider]: {
              reasoningEffort: reasoningEffort,
            },
          },
        }),
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
        error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
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

    // DEBUG: Log reasoning effort lookup
    const reasoningEffort = getModelReasoningEffort(params.model.modelId, provider);
    console.log("[DEBUG generateStructuredText] Model:", params.model.modelId);
    console.log("[DEBUG generateStructuredText] Provider:", provider);
    console.log("[DEBUG generateStructuredText] Reasoning Effort:", reasoningEffort);
    console.log("[DEBUG generateStructuredText] Model provider from params:", params.model.provider);

    try {
      // Only use native structured output if both provider and model support it
      if (capabilities.supportsNativeStructuredOutput && supportsJsonSchema) {
        // Use native structured output
        console.log("[DEBUG generateStructuredText] Request options:", {
          model: modelId,
          provider: provider,
          reasoningEffort: reasoningEffort,
          hasProviderOptions: !!reasoningEffort,
        });
        const result = await generateText({
          model: registry.languageModel(modelId),
          output: Output.object({
            schema: PRResponseSchema,
          }),
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          // Apply reasoning effort from model configuration if specified
          ...(reasoningEffort && {
            providerOptions: {
              [provider]: {
                reasoningEffort: reasoningEffort,
              },
            },
          }),
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
        error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
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
    const modelProvider = params.model.provider || "openrouter";

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
        // Apply reasoning effort from model configuration if specified
        ...(getModelReasoningEffort(
          params.model.modelId,
          modelProvider,
        ) && {
          providerOptions: {
            [modelProvider]: {
              reasoningEffort: getModelReasoningEffort(
                params.model.modelId,
                modelProvider,
              ),
            },
          },
        }),
      });

      // Try to parse JSON from the response
      try {
        // Strip markdown code blocks if present
        const cleanedText = stripMarkdownCodeBlocks(text);
        
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
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
        error: `JSON fallback failed: ${formatAISDKErrorMessage(error)}`,
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

    // Get reasoning effort from model configuration if specified
    const reasoningEffort = getModelReasoningEffort(params.model.modelId, provider);

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
          // Apply reasoning effort from model configuration if specified
          ...(reasoningEffort && {
            providerOptions: {
              [provider]: {
                reasoningEffort: reasoningEffort,
              },
            },
          }),
        });

        let accumulatedData: Partial<PRResponse> = {};

        try {
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
        } catch (error) {
          yield {
            type: "error",
            error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
          };
          return;
        }

        yield {
          type: "complete",
        };
      } else {
        // Fallback to regular text streaming for models that don't support JSON Schema
        try {
          const { textStream } = await streamText({
            model: registry.languageModel(modelId as `${string}:${string}`),
            messages: [
              {
                role: "system",
                content: `${params.systemPrompt}\n\nIMPORTANT: You must respond with valid JSON in this exact format:\n{\n  "title": "A concise PR title",\n  "description": "The full PR description in Markdown format"\n}`,
              },
              { role: "user", content: params.userPrompt },
            ],
            // Apply reasoning effort from model configuration if specified
            ...(reasoningEffort && {
              providerOptions: {
                [provider]: {
                  reasoningEffort: reasoningEffort,
                },
              },
            }),
          });

          let accumulatedText = "";

          try {
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
          } catch (error) {
            yield {
              type: "error",
              error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
            };
            return;
          }
          
          // Try to parse JSON and extract structured data
          try {
            // Strip markdown code blocks if present
            const cleanedText = stripMarkdownCodeBlocks(accumulatedText);
            
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              yield {
                type: "partial",
                data: {
                  title: parsed.title,
                  description: parsed.description,
                  isComplete: false,
                },
              };
            }
          } catch {
            // JSON parsing failed, accumulatedText will be used as description
          }

          yield {
            type: "complete",
          };
        } catch (error) {
          yield {
            type: "error",
            error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
          };
          return;
        }
      }
    } catch (error) {
      yield {
        type: "error",
        error: `AI SDK Error: ${formatAISDKErrorMessage(error)}`,
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
