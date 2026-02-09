import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDevServe = command === "serve" && mode !== "production";

  return {
    plugins: [react(), tailwindcss(), crx({ manifest })],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Mock Next.js modules to satisfy nextstepjs peer dependencies
        "next/navigation": path.resolve(
          __dirname,
          "./src/mocks/next-navigation.ts",
        ),
        "next/router": path.resolve(
          __dirname,
          "./src/mocks/next-navigation.ts",
        ),
      },
    },
    optimizeDeps: {
      // Exclude nextstepjs from pre-bundling to avoid Next.js adapter resolution
      exclude: ["nextstepjs"],
    },
    build: {
      outDir: isDevServe ? "dist-dev" : "dist",
      emptyOutDir: command === "build",
      rollupOptions: {
        input: {
          popup: "src/popup/index.html",
          options: "src/options/index.html",
        },
      },
    },
    ssr: {
      // Ensure nextstepjs and motion are bundled properly
      noExternal: ["nextstepjs", "motion"],
    },
    server: {
      port: 5000,
      strictPort: true,
      hmr: {
        port: 5000,
      },
      cors: true,
      origin: "http://localhost:5000",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  };
});
