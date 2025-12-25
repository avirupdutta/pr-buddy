import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { PopupApp } from "@/popup/App";
import { OptionsApp } from "@/options/App";
import { isExtensionContext } from "@/services/dev-mock";
import { Toaster } from "@/components/ui/sonner";

// Navigation event listener for dev mode
function NavigationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigation = (event: CustomEvent<{ path: string }>) => {
      navigate(event.detail.path);
    };

    window.addEventListener("dev-navigate", handleNavigation as EventListener);

    return () => {
      window.removeEventListener(
        "dev-navigate",
        handleNavigation as EventListener
      );
    };
  }, [navigate]);

  return null;
}

// Dev mode layout with popup frame
function DevPopupLayout() {
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-8">
      <div className="flex flex-col gap-4 items-center">
        <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
          Dev Mode: Popup Preview
        </div>
        <div className="w-[400px] h-[500px] border border-border rounded-lg overflow-hidden shadow-2xl bg-background">
          <PopupApp />
        </div>
      </div>
    </div>
  );
}

export function App() {
  // In Chrome extension context, don't use router
  if (isExtensionContext()) {
    return <PopupApp />;
  }

  // In dev mode, use React Router for navigation
  return (
    <BrowserRouter>
      <NavigationListener />
      <Routes>
        <Route path="/" element={<DevPopupLayout />} />
        <Route path="/options" element={<OptionsApp />} />
      </Routes>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}

export default App;
