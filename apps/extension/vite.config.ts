import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "build",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        diagnostics: fileURLToPath(
          new URL("./src/diagnostics/index.html", import.meta.url),
        ),
      },
    },
  },
});
