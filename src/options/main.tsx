import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";
import { OptionsApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OptionsApp />
    <Toaster position="top-center" />
  </StrictMode>
);
