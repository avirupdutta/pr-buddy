// ============================================
// PostHog Analytics Events Constants
// ============================================

export const EVENTS = {
  // Popup/Page Events
  POPUP_OPENED: "popup_opened",
  POPUP_CLOSED: "popup_closed",
  OPTIONS_PAGE_OPENED: "options_page_opened",
  OPTIONS_PAGE_CLOSED: "options_page_closed",

  // Button Click Events
  BUTTON_CLICKED: "button_clicked",
  GENERATE_CLICKED: "generate_clicked",
  REGENERATE_CLICKED: "regenerate_clicked",
  COPY_CLICKED: "copy_clicked",
  APPLY_CLICKED: "apply_clicked",
  STOP_GENERATION_CLICKED: "stop_generation_clicked",
  GO_BACK_CLICKED: "go_back_clicked",
  SETTINGS_CLICKED: "settings_clicked",

  // Settings Events
  SETTINGS_SAVED: "settings_saved",
  SETTINGS_TAB_CHANGED: "settings_tab_changed",
  API_KEY_ADDED: "api_key_added",
  API_KEY_REMOVED: "api_key_removed",
  THEME_CHANGED: "theme_changed",
  DEV_MODE_TOGGLED: "dev_mode_toggled",

  // Template Events
  TEMPLATE_SELECTED: "template_selected",
  TEMPLATE_ADDED: "template_added",
  TEMPLATE_UPDATED: "template_updated",
  TEMPLATE_DELETED: "template_deleted",

  // Model Events
  MODEL_SELECTED: "model_selected",
  MODEL_SELECTOR_OPENED: "model_selector_opened",
  MODEL_SELECTOR_CLOSED: "model_selector_closed",
  MODEL_SEARCHED: "model_searched",
  MODEL_ADDED: "model_added",
  MODEL_UPDATED: "model_updated",
  MODEL_DELETED: "model_deleted",
  MODEL_SET_ACTIVE: "model_set_active",

  // Generation Events
  GENERATION_STARTED: "generation_started",
  GENERATION_COMPLETED: "generation_completed",
  GENERATION_FAILED: "generation_failed",
  GENERATION_STOPPED: "generation_stopped",
  STREAMING_STARTED: "streaming_started",
  STREAMING_COMPLETED: "streaming_completed",
  STREAMING_ERROR: "streaming_error",

  // Tone Events
  TONE_SELECTED: "tone_selected",

  // Context/Input Events
  CONTEXT_ADDED: "context_added",
  GENERATE_TITLE_TOGGLED: "generate_title_toggled",

  // Result View Events
  VIEW_RAW_SELECTED: "view_raw_selected",
  VIEW_PREVIEW_SELECTED: "view_preview_selected",
  DESCRIPTION_EDITED: "description_edited",
  TITLE_EDITED: "title_edited",

  // Onboarding Events
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_STEP_VIEWED: "onboarding_step_viewed",
  TOUR_RESTARTED: "tour_restarted",

  // Error Events
  ERROR_OCCURRED: "error_occurred",
  VALIDATION_FAILED: "validation_failed",

  // System Events
  EXTENSION_INSTALLED: "extension_installed",
  EXTENSION_UPDATED: "extension_updated",
  STORAGE_CLEARED: "storage_cleared",
} as const;

// Event type for type safety
export type AnalyticsEvent = typeof EVENTS[keyof typeof EVENTS];

// ============================================
// Event Properties Types
// ============================================

export interface GenerateClickedProperties {
  url: string;
  has_context: boolean;
  context_length?: number;
  template_id: string;
  tone: string;
  model_id: string;
  model_provider: string;
  generate_title: boolean;
  [key: string]: unknown;
}

export interface GenerationCompletedProperties {
  url: string;
  duration_ms: number;
  description_length: number;
  title_length?: number;
  model_id: string;
  model_provider: string;
  template_id: string;
  tone: string;
  has_context: boolean;
  was_regeneration: boolean;
  [key: string]: unknown;
}

export interface GenerationFailedProperties {
  url: string;
  error_message: string;
  error_code?: string;
  model_id: string;
  model_provider: string;
  template_id: string;
  stage: "init" | "streaming" | "parsing" | "other";
  [key: string]: unknown;
}

export interface SettingsSavedProperties {
  has_github_token: boolean;
  has_openrouter_key: boolean;
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_google_key: boolean;
  has_groq_key: boolean;
  has_cerebras_key: boolean;
  dev_mode_enabled: boolean;
  theme: string;
  custom_models_count: number;
  custom_templates_count: number;
  [key: string]: unknown;
}

export interface ModelSelectedProperties {
  model_id: string;
  model_name: string;
  model_provider: string;
  is_custom_model: boolean;
  has_api_key: boolean;
  [key: string]: unknown;
}

export interface TemplateSelectedProperties {
  template_id: string;
  template_title: string;
  is_custom_template: boolean;
  [key: string]: unknown;
}

export interface ToneSelectedProperties {
  tone: string;
  previous_tone: string;
  [key: string]: unknown;
}

export interface ErrorOccurredProperties {
  error_message: string;
  error_stack?: string;
  component?: string;
  action?: string;
  url?: string;
  [key: string]: unknown;
}

// ============================================
// Screen/View Names for Page Tracking
// ============================================

export const SCREENS = {
  POPUP: "popup",
  OPTIONS: "options",
  POPUP_GENERATOR: "popup_generator",
  POPUP_RESULT: "popup_result",
  OPTIONS_GENERAL: "options_general",
  OPTIONS_TEMPLATES: "options_templates",
  OPTIONS_AI_MODELS: "options_ai_models",
  OPTIONS_DEVELOPER: "options_developer",
} as const;

export type AnalyticsScreen = typeof SCREENS[keyof typeof SCREENS];

// ============================================
// Feature Flags (for future use)
// ============================================

export const FEATURE_FLAGS = {
  NEW_UI: "new-ui",
  ADVANCED_MODELS: "advanced-models",
  TEMPLATE_SUGGESTIONS: "template-suggestions",
} as const;
