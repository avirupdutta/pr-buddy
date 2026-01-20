import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ReviewApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ReviewApp />
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>
);
