import { z } from 'zod';

// Zod schema for PR response validation
// Note: Groq API requires all properties to be listed in `required` array
// when using structured output with response_format
export const PRResponseSchema = z.object({
  title: z.string().describe('The PR title'),
  description: z.string().describe('The PR description in markdown format'),
});

// Export type inference from schema
export type PRResponse = z.infer<typeof PRResponseSchema>;

// Structured output generation parameters
export interface StructuredOutputParams {
  model: string;
  provider: string;
  systemPrompt: string;
  userPrompt: string;
  stream?: boolean;
}

// Structured output result
export interface StructuredOutputResult {
  success: true;
  data: PRResponse;
  provider: string;
  model: string;
}

// Structured output error
export interface StructuredOutputError {
  success: false;
  error: string;
  provider: string;
  model: string;
}

// Union type for structured output responses
export type StructuredOutputResponse = StructuredOutputResult | StructuredOutputError;

// Streaming structured output partial result
export interface PartialStructuredOutput {
  title?: string;
  description?: string;
  isComplete: boolean;
}

// Structured output stream event
export interface StructuredStreamEvent {
  type: 'partial' | 'complete' | 'error';
  data?: PartialStructuredOutput;
  error?: string;
}

// Provider capability flags
export interface ProviderCapabilities {
  supportsNativeStructuredOutput: boolean;
  fallbackToJSONParsing: boolean;
  supportsStreamingStructuredOutput: boolean;
}