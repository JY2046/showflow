import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createFirebaseConfigMiddleware } from "./server/firebase-config.mjs";
import { createApiMiddleware } from "./server/api.mjs";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: { manualChunks: { "pptx-import": ["jszip", "fast-xml-parser"] } },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [
    react(),
    {
      name: "showflow-local-api",
      configureServer(server) {
        server.middlewares.use("/api/showflow", createFirebaseConfigMiddleware());
        server.middlewares.use("/api/showflow", createApiMiddleware());
      },
    },
  ],
});
