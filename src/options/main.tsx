import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";
import { ThemeProvider } from "@/components/theme-provider";
import { OptionsApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <OptionsApp />
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>
);
