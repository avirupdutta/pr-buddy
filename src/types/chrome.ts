// Chrome extension message types for type-safe communication

// PR Template for CRUD management
export interface PRTemplate {
  id: string;
  title: string;
  structure: string;
}

// AI Model for CRUD management
export interface AIModel {
  id: string;
  name: string;
  modelId: string;
  isActive: boolean;
}

// Legacy type - kept for backwards compatibility during migration
export type TemplateType =
  | "default"
  | "bug"
  | "feature"
  | "refactor"
  | "hotfix";
export type ToneType = "professional" | "casual" | "concise" | "auto";

export interface PRDetails {
  owner: string;
  repo: string;
  number: string;
}

export interface GeneratorSettings {
  templateId: string; // Template ID from user-defined templates
  context: string;
  tone: ToneType;
  includeTickets: boolean;
}

export interface PRMetadata {
  title: string;
  head: { ref: string };
  base: { ref: string };
  changed_files?: number;
  additions?: number;
  deletions?: number;
}

// Message types for chrome.runtime.sendMessage
export type MessageAction =
  | { action: "GENERATE_DESCRIPTION"; url: string; settings: GeneratorSettings }
  | { action: "UPDATE_PR_DESCRIPTION"; url: string; description: string }
  | { action: "UPDATE_DESCRIPTION"; description: string };

export type GenerateDescriptionMessage = Extract<
  MessageAction,
  { action: "GENERATE_DESCRIPTION" }
>;
export type UpdatePRDescriptionMessage = Extract<
  MessageAction,
  { action: "UPDATE_PR_DESCRIPTION" }
>;
export type UpdateDescriptionMessage = Extract<
  MessageAction,
  { action: "UPDATE_DESCRIPTION" }
>;

// Response types
export interface GenerateResponse {
  success: true;
  description: string;
  prDetails: PRDetails;
}

export interface UpdateResponse {
  success: true;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type MessageResponse<T = unknown> =
  | (T & { success: true })
  | ErrorResponse;

// Chrome storage types
export interface StoredSettings {
  githubToken?: string;
  openRouterKey?: string;
  devMode?: boolean;
  devPrUrl?: string;
  theme?: "dark" | "light" | "system";
  templates?: PRTemplate[];
  aiModels?: AIModel[];
  encryptionSalt?: string; // Salt for API key encryption
}

export interface StoredPreferences {
  prTemplate?: string; // Template ID
  customContext?: string;
  includeTickets?: boolean;
  descriptionTone?: ToneType;
}
