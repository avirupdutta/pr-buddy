import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useGeneratorStore } from "@/stores/generator-store";
import { getCurrentTabUrl, openOptionsPage } from "@/services/chrome-messaging";
import { Header } from "./components/Header";
import { GeneratorView } from "./components/GeneratorView";
import { ResultView } from "./components/ResultView";

export function PopupApp() {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const {
    load: loadSettings,
    hasValidKeys,
    isLoading: isLoadingSettings,
  } = useSettingsStore();
  const { view, loadPreferences } = useGeneratorStore();

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Load settings and preferences
      await loadSettings();
      await loadPreferences();

      // Get current tab info
      const tabInfo = await getCurrentTabUrl();
      if (tabInfo) {
        setCurrentUrl(tabInfo.url);
      }
    };

    init();
  }, [loadSettings, loadPreferences]);

  // Redirect to options if no API keys
  useEffect(() => {
    if (!isLoadingSettings && !hasValidKeys()) {
      openOptionsPage();
      window.close();
    }
  }, [isLoadingSettings, hasValidKeys]);

  // Show loading state
  if (isLoadingSettings) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <Header />
      {view === "generator" ? (
        <GeneratorView currentUrl={currentUrl} />
      ) : (
        <ResultView currentUrl={currentUrl} />
      )}
    </div>
  );
}
