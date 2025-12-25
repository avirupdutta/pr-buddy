import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useGeneratorStore } from "@/stores/generator-store";
import { getCurrentTabUrl, openOptionsPage } from "@/services/chrome-messaging";
import { Header } from "./components/Header";
import { GeneratorView } from "./components/GeneratorView";
import { ResultView } from "./components/ResultView";
import { isDev } from "@/services/is-dev";

export function PopupApp() {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const {
    load: loadSettings,
    hasValidKeys,
    isLoading: isLoadingSettings,
    devMode,
    devPrUrl,
  } = useSettingsStore();
  const { view, loadPreferences } = useGeneratorStore();

  // Initialize on mount
  useEffect(() => {
    loadSettings();
    loadPreferences();
  }, [loadSettings, loadPreferences]);

  // Determine URL based on settings (Dev Mode) or active tab
  useEffect(() => {
    const fetchUrl = async () => {
      if (isLoadingSettings) return;

      if (isDev && devMode && devPrUrl) {
        setCurrentUrl(devPrUrl);
        return;
      }

      const tabInfo = await getCurrentTabUrl();
      if (tabInfo) {
        setCurrentUrl(tabInfo.url);
      }
    };

    fetchUrl();
  }, [devMode, devPrUrl, isLoadingSettings]);

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
      {isDev && devMode && (
        <div className="bg-amber-500/10 text-amber-600 text-[10px] uppercase tracking-wider px-4 py-1 flex items-center justify-center font-bold border-t border-amber-500/20">
          Developer Mode: Active
        </div>
      )}
      <Header />
      {view === "generator" ? (
        <GeneratorView currentUrl={currentUrl} />
      ) : (
        <ResultView currentUrl={currentUrl} />
      )}
    </div>
  );
}
