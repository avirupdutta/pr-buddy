import posthog from "posthog-js";
import { EVENTS, type AnalyticsEvent, type AnalyticsScreen } from "@/data/constants";
import type {
  GenerateClickedProperties,
  GenerationCompletedProperties,
  GenerationFailedProperties,
  SettingsSavedProperties,
  ModelSelectedProperties,
  TemplateSelectedProperties,
  ToneSelectedProperties,
  ErrorOccurredProperties,
} from "@/data/constants";

// ============================================
// Analytics Service
// ============================================

class AnalyticsService {
  private static instance: AnalyticsService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public initialize(): void {
    if (this.isInitialized) return;

    const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
    const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

    if (!apiKey || !apiHost) {
      console.warn("PostHog not configured - analytics disabled");
      return;
    }

    posthog.init(apiKey, {
      api_host: apiHost,
      capture_pageview: false, // We'll handle pageviews manually
      capture_pageleave: false,
      autocapture: false, // We'll capture events manually for better control
      disable_session_recording: true, // Disable for privacy in extension
      persistence: "localStorage", // Use localStorage for extension context
      loaded: () => {
        this.isInitialized = true;
        console.log("PostHog analytics initialized");
      },
    });
  }

  // ============================================
  // Core Tracking Methods
  // ============================================

  public track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (posthog.__loaded) {
      posthog.capture(event, {
        ...properties,
        timestamp: new Date().toISOString(),
        source: "chrome_extension",
        version: this.getExtensionVersion(),
      });
    }
  }

  public trackPageView(screen: AnalyticsScreen, properties?: Record<string, unknown>): void {
    this.track(EVENTS.POPUP_OPENED, {
      screen,
      ...properties,
    });
  }

  public identify(userId: string, properties?: Record<string, unknown>): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (posthog.__loaded) {
      posthog.identify(userId, properties);
    }
  }

  public reset(): void {
    if (posthog.__loaded) {
      posthog.reset();
    }
  }

  // ============================================
  // Specific Event Trackers
  // ============================================

  public trackGenerateClicked(properties: GenerateClickedProperties): void {
    this.track(EVENTS.GENERATE_CLICKED, properties);
  }

  public trackRegenerateClicked(properties: { url: string; model_id: string; model_provider: string; [key: string]: unknown }): void {
    this.track(EVENTS.REGENERATE_CLICKED, properties);
  }

  public trackGenerationCompleted(properties: GenerationCompletedProperties): void {
    this.track(EVENTS.GENERATION_COMPLETED, properties);
  }

  public trackGenerationFailed(properties: GenerationFailedProperties): void {
    this.track(EVENTS.GENERATION_FAILED, properties);
  }

  public trackGenerationStopped(properties: { 
    url: string; 
    model_id: string; 
    partial_description_length: number;
    reason: "user_cancelled" | "error" | "timeout";
    [key: string]: unknown;
  }): void {
    this.track(EVENTS.GENERATION_STOPPED, properties);
  }

  public trackCopyClicked(properties: { 
    description_length: number; 
    has_title: boolean;
    view_type: "raw" | "preview";
    [key: string]: unknown;
  }): void {
    this.track(EVENTS.COPY_CLICKED, properties);
  }

  public trackApplyClicked(properties: { 
    url: string; 
    description_length: number;
    has_title: boolean;
    model_id: string;
    model_provider: string;
    [key: string]: unknown;
  }): void {
    this.track(EVENTS.APPLY_CLICKED, properties);
  }

  public trackSettingsSaved(properties: SettingsSavedProperties): void {
    this.track(EVENTS.SETTINGS_SAVED, properties);
  }

  public trackSettingsTabChanged(properties: { tab: string; previous_tab: string; [key: string]: unknown }): void {
    this.track(EVENTS.SETTINGS_TAB_CHANGED, properties);
  }

  public trackModelSelected(properties: ModelSelectedProperties): void {
    this.track(EVENTS.MODEL_SELECTED, properties);
  }

  public trackTemplateSelected(properties: TemplateSelectedProperties): void {
    this.track(EVENTS.TEMPLATE_SELECTED, properties);
  }

  public trackToneSelected(properties: ToneSelectedProperties): void {
    this.track(EVENTS.TONE_SELECTED, properties);
  }

  public trackTemplateAdded(properties: { template_id: string; template_title: string; [key: string]: unknown }): void {
    this.track(EVENTS.TEMPLATE_ADDED, properties);
  }

  public trackTemplateUpdated(properties: { template_id: string; template_title: string; [key: string]: unknown }): void {
    this.track(EVENTS.TEMPLATE_UPDATED, properties);
  }

  public trackTemplateDeleted(properties: { template_id: string; template_title: string; [key: string]: unknown }): void {
    this.track(EVENTS.TEMPLATE_DELETED, properties);
  }

  public trackModelAdded(properties: { model_id: string; model_name: string; model_provider: string; [key: string]: unknown }): void {
    this.track(EVENTS.MODEL_ADDED, properties);
  }

  public trackModelUpdated(properties: { model_id: string; model_name: string; model_provider: string; [key: string]: unknown }): void {
    this.track(EVENTS.MODEL_UPDATED, properties);
  }

  public trackModelDeleted(properties: { model_id: string; model_name: string; model_provider: string; [key: string]: unknown }): void {
    this.track(EVENTS.MODEL_DELETED, properties);
  }

  public trackOnboardingStep(properties: { step_id: string; step_name: string; step_number: number; total_steps: number; [key: string]: unknown }): void {
    this.track(EVENTS.ONBOARDING_STEP_VIEWED, properties);
  }

  public trackOnboardingCompleted(properties: { total_steps_completed: number; duration_ms: number; [key: string]: unknown }): void {
    this.track(EVENTS.ONBOARDING_COMPLETED, properties);
  }

  public trackTourRestarted(properties: { tour_name: string; [key: string]: unknown }): void {
    this.track(EVENTS.TOUR_RESTARTED, properties);
  }

  public trackError(properties: ErrorOccurredProperties): void {
    this.track(EVENTS.ERROR_OCCURRED, {
      ...properties,
      user_agent: navigator.userAgent,
    });
  }

  public trackButtonClick(buttonName: string, properties?: Record<string, unknown>): void {
    this.track(EVENTS.BUTTON_CLICKED, {
      button_name: buttonName,
      ...properties,
    });
  }

  public trackThemeChange(theme: string, previousTheme: string): void {
    this.track(EVENTS.THEME_CHANGED, {
      theme,
      previous_theme: previousTheme,
    });
  }

  public trackDevModeToggle(enabled: boolean): void {
    this.track(EVENTS.DEV_MODE_TOGGLED, {
      enabled,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  private getExtensionVersion(): string {
    try {
      // Try to get version from chrome.runtime if available
      if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
        return chrome.runtime.getManifest().version;
      }
    } catch {
      // Fallback to empty string if not in extension context
    }
    return "unknown";
  }

  public isReady(): boolean {
    return this.isInitialized && posthog.__loaded;
  }
}

// ============================================
// Hook for React Components
// ============================================

export function useAnalytics() {
  const analytics = AnalyticsService.getInstance();
  return {
    track: analytics.track.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackGenerateClicked: analytics.trackGenerateClicked.bind(analytics),
    trackRegenerateClicked: analytics.trackRegenerateClicked.bind(analytics),
    trackGenerationCompleted: analytics.trackGenerationCompleted.bind(analytics),
    trackGenerationFailed: analytics.trackGenerationFailed.bind(analytics),
    trackGenerationStopped: analytics.trackGenerationStopped.bind(analytics),
    trackCopyClicked: analytics.trackCopyClicked.bind(analytics),
    trackApplyClicked: analytics.trackApplyClicked.bind(analytics),
    trackSettingsSaved: analytics.trackSettingsSaved.bind(analytics),
    trackSettingsTabChanged: analytics.trackSettingsTabChanged.bind(analytics),
    trackModelSelected: analytics.trackModelSelected.bind(analytics),
    trackTemplateSelected: analytics.trackTemplateSelected.bind(analytics),
    trackToneSelected: analytics.trackToneSelected.bind(analytics),
    trackTemplateAdded: analytics.trackTemplateAdded.bind(analytics),
    trackTemplateUpdated: analytics.trackTemplateUpdated.bind(analytics),
    trackTemplateDeleted: analytics.trackTemplateDeleted.bind(analytics),
    trackModelAdded: analytics.trackModelAdded.bind(analytics),
    trackModelUpdated: analytics.trackModelUpdated.bind(analytics),
    trackModelDeleted: analytics.trackModelDeleted.bind(analytics),
    trackOnboardingStep: analytics.trackOnboardingStep.bind(analytics),
    trackOnboardingCompleted: analytics.trackOnboardingCompleted.bind(analytics),
    trackTourRestarted: analytics.trackTourRestarted.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackButtonClick: analytics.trackButtonClick.bind(analytics),
    trackThemeChange: analytics.trackThemeChange.bind(analytics),
    trackDevModeToggle: analytics.trackDevModeToggle.bind(analytics),
    isReady: analytics.isReady.bind(analytics),
  };
}

// ============================================
// Export singleton instance
// ============================================

export const analytics = AnalyticsService.getInstance();
export default analytics;
